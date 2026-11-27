package com.fresnica.wallet

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// IO methods run off the bridge thread. The process-shared IO/lease locks also
// protect overlapping module lifetimes; revocation never waits for disk IO.
internal class TokenIconDiskCache(
  private val directory: File,
  private val now: () -> Long = System::currentTimeMillis,
  private val imageMime: (ByteArray) -> String? = PublicAssetValidation::checkedImageMime,
  private val avatar: Boolean = false,
) {
  data class Entry(val mimeType: String, val bytes: ByteArray, val sourceUrl: String, val savedAtUnixMs: Long)

  private class State {
    val lock = Any()
    val ioLock = Any()
    val sessions = mutableSetOf<String>()
    var generation = 0L
    var clearRequired = false
    var epoch = "0"
  }

  private val imageLimit = if (avatar) MAX_AVATAR_IMAGE_BYTES else MAX_IMAGE_BYTES
  private val entryLimit = imageLimit + MAX_SOURCE_BYTES + 84
  private val byteLimit = if (avatar) 16L * 1024 * 1024 else MAX_BYTES
  private val countLimit = if (avatar) 128 else MAX_ENTRIES
  private val state = states.computeIfAbsent(directory.absoluteFile.normalize().path) { State() }
  private val ownedSessions = mutableSetOf<String>()
  private var retired = false

  // Capture before scheduling open. An open queued before privacy OFF cannot
  // issue a fresh lease after OFF revoked the preceding generation.
  fun openGeneration(): Long = synchronized(state.lock) {
    check(!retired)
    state.generation
  }

  fun open(generation: Long = openGeneration(), epoch: String = "0"): String = synchronized(state.ioLock) {
    require(EPOCH.matches(epoch))
    synchronized(state.lock) { check(!retired && generation == state.generation) }
    if (synchronized(state.lock) { state.clearRequired }) clear()
    if (state.epoch != epoch) {
      synchronized(state.lock) { state.sessions.clear() }
      state.epoch = epoch
    }
    prepareDirectory()
    trim(0, 0)
    synchronized(state.lock) {
      check(!retired && generation == state.generation && !state.clearRequired)
      UUID.randomUUID().toString().also {
        state.sessions.add(it)
        ownedSessions.add(it)
      }
    }
  }

  fun revoke(sessionId: String, clearAll: Boolean) = synchronized(state.lock) {
    if (clearAll) {
      state.sessions.clear()
      state.generation += 1
      state.clearRequired = true
    } else state.sessions.remove(sessionId)
    ownedSessions.remove(sessionId)
    Unit
  }

  fun invalidate() = synchronized(state.lock) {
    retired = true
    state.sessions.removeAll(ownedSessions)
    ownedSessions.clear()
  }

  fun read(sessionId: String, key: String): Entry? = synchronized(state.ioLock) {
    requireSession(sessionId)
    val identity = identityHash(key)
    prepareDirectory()
    val file = fileFor(identity)
    if (!file.exists()) return null
    val entry = try {
      check(Files.isRegularFile(file.toPath(), LinkOption.NOFOLLOW_LINKS))
      val length = file.length()
      check(length in 1..entryLimit.toLong())
      val envelope = ByteArray(length.toInt())
      DataInputStream(file.inputStream()).use { input ->
        input.readFully(envelope)
        check(input.read() == -1)
      }
      check(envelope.size in 84..entryLimit)
      val payload = envelope.copyOfRange(0, envelope.size - 32)
      check(MessageDigest.isEqual(hash(payload), envelope.copyOfRange(payload.size, envelope.size)))
      DataInputStream(ByteArrayInputStream(payload)).use { input ->
        check(input.readInt() == MAGIC)
        val savedAt = input.readLong()
        check(savedAt > 0 && (!avatar || fresh(savedAt)))
        val savedIdentity = ByteArray(32).also(input::readFully)
        check(MessageDigest.isEqual(identity, savedIdentity))
        val sourceSize = input.readInt()
        check(sourceSize in 1..MAX_SOURCE_BYTES)
        val source = StandardCharsets.UTF_8.newDecoder()
          .onMalformedInput(CodingErrorAction.REPORT)
          .onUnmappableCharacter(CodingErrorAction.REPORT)
          .decode(ByteBuffer.wrap(ByteArray(sourceSize).also(input::readFully))).toString()
        check(validSource(key, source))
        val imageSize = input.readInt()
        check(imageSize in 1..imageLimit)
        val bytes = ByteArray(imageSize).also(input::readFully)
        check(input.read() == -1)
        val mime = imageMime(bytes) ?: error("invalid image")
        Entry(mime, bytes, source, savedAt)
      }
    } catch (_: Exception) {
      Files.deleteIfExists(file.toPath())
      null
    }
    synchronized(state.lock) {
      requireSessionLocked(sessionId)
      if (entry != null && !avatar) file.setLastModified(now())
      entry
    }
  }

  fun write(sessionId: String, key: String, sourceUrl: String, bytes: ByteArray): Unit = synchronized(state.ioLock) {
    requireSession(sessionId)
    val identity = identityHash(key)
    check(validSource(key, sourceUrl))
    check(bytes.size in 1..imageLimit && imageMime(bytes) != null)
    val source = sourceUrl.toByteArray(Charsets.UTF_8)
    check(source.size in 1..MAX_SOURCE_BYTES)
    val savedAt = now()
    check(savedAt > 0)
    val payload = ByteArrayOutputStream().also { buffer ->
      DataOutputStream(buffer).use { output ->
        output.writeInt(MAGIC)
        output.writeLong(savedAt)
        output.write(identity)
        output.writeInt(source.size)
        output.write(source)
        output.writeInt(bytes.size)
        output.write(bytes)
      }
    }.toByteArray()
    val envelope = payload + hash(payload)
    requireSession(sessionId)
    prepareDirectory()
    val destination = fileFor(identity)
    // Reserve the temporary file too: actual disk use remains bounded even
    // during atomic replacement. Preserve the prior winner until commit.
    trim(envelope.size.toLong(), 1, destination.name)
    requireSession(sessionId)
    val temporary = Files.createTempFile(directory.toPath(), ".pending-", ".tmp").toFile()
    try {
      FileOutputStream(temporary).use { stream ->
        stream.write(envelope)
        stream.fd.sync()
      }
      synchronized(state.lock) {
        requireSessionLocked(sessionId)
        Files.move(temporary.toPath(), destination.toPath(),
          StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        destination.setLastModified(savedAt)
      }
    } finally {
      Files.deleteIfExists(temporary.toPath())
    }
  }

  fun remove(sessionId: String, key: String): Unit = synchronized(state.ioLock) {
    val identity = identityHash(key)
    synchronized(state.lock) {
      requireSessionLocked(sessionId)
      Files.deleteIfExists(fileFor(identity).toPath())
    }
  }

  fun clear(): Unit = synchronized(state.ioLock) {
    val generation = synchronized(state.lock) {
      if (!state.clearRequired) return
      state.generation
    }
    if (directory.exists()) {
      check(!Files.isSymbolicLink(directory.toPath()))
      val files = directory.listFiles() ?: throw IOException("cache unavailable")
      files.forEach { Files.deleteIfExists(it.toPath()) }
    }
    synchronized(state.lock) {
      // Failed deletion leaves this flag set. Later open retries the purge
      // before issuing any lease, so OFF/ON cannot resurrect old bytes.
      if (generation == state.generation) state.clearRequired = false
    }
  }

  private fun prepareDirectory() {
    check(!Files.isSymbolicLink(directory.toPath()))
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("cache unavailable")
  }

  private fun trim(reservedBytes: Long, reservedEntries: Int, preserveName: String? = null) {
    val files = mutableListOf<File>()
    val prefix = "${state.epoch}-"
    for (file in directory.listFiles() ?: throw IOException("cache unavailable")) {
      if (!file.name.startsWith(prefix) || !ENTRY_NAME.matches(file.name.removePrefix(prefix)) ||
          !Files.isRegularFile(file.toPath(), LinkOption.NOFOLLOW_LINKS) ||
          file.length() !in 1..entryLimit.toLong() || (avatar && !fresh(file.lastModified()))) {
        Files.deleteIfExists(file.toPath())
      } else files.add(file)
    }
    var size = files.sumOf { it.length() } + reservedBytes
    var count = files.size + reservedEntries
    for (file in files.sortedWith(compareBy<File> { it.lastModified() }.thenBy { it.name })) {
      if (size <= byteLimit && count <= countLimit) break
      if (file.name == preserveName) continue
      val length = file.length()
      Files.delete(file.toPath())
      size -= length
      count -= 1
    }
    check(size <= byteLimit && count <= countLimit)
  }

  private fun identityHash(key: String): ByteArray {
    require((if (avatar) AVATAR_KEY else KEY).matches(key))
    return hash(key.toByteArray(Charsets.UTF_8))
  }

  private fun fresh(savedAt: Long): Boolean {
    val time = now()
    return savedAt > 0 && savedAt <= time && time - savedAt < 7L * 24 * 60 * 60 * 1000
  }

  private fun validSource(key: String, source: String): Boolean {
    if (!avatar) return PublicAssetValidation.safeAssetUrl(source) != null
    val address = AVATAR_KEY.matchEntire(key)?.groupValues?.get(2) ?: return false
    return source == "https://horizon.stellarcn.org/avatar/v2/$address?size=256"
  }

  private fun fileFor(identity: ByteArray): File =
    File(directory, "${state.epoch}-" + identity.joinToString("") { "%02x".format(it) } + ".icon")

  private fun requireSession(sessionId: String) = synchronized(state.lock) { requireSessionLocked(sessionId) }

  private fun requireSessionLocked(sessionId: String) {
    check(!retired && !state.clearRequired && state.sessions.contains(sessionId))
  }

  private fun hash(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

  companion object {
    const val MAX_BYTES = 20L * 1024 * 1024
    const val MAX_ENTRIES = 500
    const val MAX_IMAGE_BYTES = 65_536
    private const val MAX_SOURCE_BYTES = 8192
    const val MAX_AVATAR_IMAGE_BYTES = 262_144
    private const val MAGIC = 0x46494331
    private val EPOCH = Regex("0|[1-9][0-9]{0,15}")
    private val ENTRY_NAME = Regex("[a-f0-9]{64}\\.icon")
    private val KEY = Regex("""^\["(stellar-mainnet|stellar-testnet)","[A-Za-z0-9]{1,12}","G[A-Z2-7]{55}"\]$""")
    private val AVATAR_KEY = Regex("""^\["(stellar-mainnet|stellar-testnet)","(G[A-Z2-7]{55}|M[A-Z2-7]{68})"\]$""")
    private val states = ConcurrentHashMap<String, State>()
  }
}
