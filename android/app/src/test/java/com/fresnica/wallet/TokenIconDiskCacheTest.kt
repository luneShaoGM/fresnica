package com.fresnica.wallet

import java.io.File
import java.nio.file.Files
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutionException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

// JVM filesystem/lease tests. The injected fixture recognizer deliberately
// does not stand in for Android BitmapFactory/native product acceptance.
class TokenIconDiskCacheTest {
  @get:Rule val temporary = TemporaryFolder()
  private var clock = 1_700_000_000_000L
  private val issuer = "G" + "A".repeat(55)
  private val source = "https://cdn.example.org/icon.png"
  private val png = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3i0AAAAASUVORK5CYII=")
  private val largePng = png.copyOf(TokenIconDiskCache.MAX_IMAGE_BYTES)

  private fun key(code: String = "USD", network: String = "stellar-mainnet", issuer: String = this.issuer) =
    "[\"$network\",\"$code\",\"$issuer\"]"

  private fun fixtureMime(bytes: ByteArray): String? =
    if (bytes.contentEquals(png) || bytes.contentEquals(largePng)) "image/png" else null

  private fun cache(directory: File, validator: (ByteArray) -> String? = ::fixtureMime) =
    TokenIconDiskCache(directory, { clock }, validator)

  private fun file(directory: File, key: String): File {
    val hash = MessageDigest.getInstance("SHA-256").digest(key.toByteArray(Charsets.UTF_8))
    return File(directory, hash.joinToString("") { "%02x".format(it) } + ".icon")
  }

  private fun rejected(block: () -> Unit) {
    try {
      block()
      fail("operation unexpectedly succeeded")
    } catch (_: Exception) {
    }
  }

  @Test fun restartReadsBinaryImageWithoutRefreshingItsSavedTime() {
    val directory = temporary.newFolder("cache")
    val first = cache(directory)
    val lease = first.open()
    first.write(lease, key(), source, png)
    first.revoke(lease, false)
    first.invalidate()
    val savedAt = clock
    clock += TimeUnit.DAYS.toMillis(8)
    val restarted = cache(directory)
    val entry = restarted.read(restarted.open(), key())!!
    assertArrayEquals(png, entry.bytes)
    assertEquals("image/png", entry.mimeType)
    assertEquals(source, entry.sourceUrl)
    assertEquals(savedAt, entry.savedAtUnixMs)
    assertEquals(clock, file(directory, key()).lastModified())
    // Freshness policy lives in the resolver; stale validated bytes remain
    // available to it after native module restart, with no network request.
  }

  @Test fun usesCaseSensitiveNetworkCodeAndFullIssuerIdentity() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    val identities = listOf(key(), key("usd"), key(network = "stellar-testnet"), key(issuer = "G" + "B".repeat(55)))
    store.write(lease, identities.first(), source, png)
    identities.drop(1).forEach { assertNull(store.read(lease, it)) }
    identities.drop(1).forEach { store.write(lease, it, source, png) }
    assertEquals(4, directory.listFiles()!!.size)
    store.remove(lease, identities.first())
    assertNull(store.read(lease, identities.first()))
    identities.drop(1).forEach { assertNotNull(store.read(lease, it)) }
  }

  @Test fun rejectsNonCanonicalOrMalformedKeysBeforeCreatingFiles() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    for (identity in listOf(
      "[\"stellar-mainnet\", \"USD\",\"$issuer\"]", key(network = "other"),
      key(""), key("TOOLONGASSET12"), key("USD/.."), key("é"),
      key(issuer = issuer.lowercase()), key(issuer = "GABC"), key(issuer = "G" + "0".repeat(55)),
      "../outside", "[]", key() + "\n",
    )) rejected { store.write(lease, identity, source, png) }
    assertEquals(0, directory.listFiles()!!.size)
  }

  @Test fun rejectedMediaOrSourceKeepsThePreviousGoodEntry() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    store.write(lease, key(), source, png)
    val savedAt = clock
    clock += 5000
    for (url in listOf(
      "http://cdn.example.org/a.png", "https://127.0.0.1/a.png", "https://[::1]/a.png",
      "https://cdn.local/a.png", "https://cdn.internal/a.png", "https://cdn.example.org:444/a.png",
      "https://user:secret@cdn.example.org/a.png", "https://cdn.example.org/a.png#fragment",
    )) rejected { store.write(lease, key(), url, png) }
    rejected { store.write(lease, key(), source, byteArrayOf(1, 2, 3)) }
    rejected { store.write(lease, key(), source, ByteArray(TokenIconDiskCache.MAX_IMAGE_BYTES + 1)) }
    val entry = store.read(lease, key())!!
    assertArrayEquals(png, entry.bytes)
    assertEquals(savedAt, entry.savedAtUnixMs)
    assertEquals(1, directory.listFiles()!!.size)
  }

  @Test fun deletesChangedTruncatedAndOversizedEnvelopes() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    val corruptions: List<(ByteArray) -> ByteArray> = listOf(
      { bytes -> bytes.copyOf().also { it[60] = (it[60].toInt() xor 1).toByte() } },
      { bytes -> bytes.copyOf(bytes.size - 8) },
      { ByteArray(100_000) },
    )
    for (corrupt in corruptions) {
      store.write(lease, key(), source, png)
      val entryFile = file(directory, key())
      entryFile.writeBytes(corrupt(entryFile.readBytes()))
      assertNull(store.read(lease, key()))
      assertFalse(entryFile.exists())
    }
  }

  @Test fun revalidatesMediaOnReadAndRejectsReboundIdentity() {
    val directory = temporary.newFolder("cache")
    val writer = cache(directory)
    val lease = writer.open()
    writer.write(lease, key(), source, png)
    file(directory, key()).copyTo(file(directory, key("EUR")))
    assertNull(writer.read(lease, key("EUR")))
    assertFalse(file(directory, key("EUR")).exists())
    val decoderRejectingCache = cache(directory) { null }
    assertNull(decoderRejectingCache.read(decoderRejectingCache.open(), key()))
    assertFalse(file(directory, key()).exists())
  }

  @Test fun evictsLeastRecentlyUsedEntryAtFiveHundredEntries() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    repeat(TokenIconDiskCache.MAX_ENTRIES) { index ->
      clock += 1000
      store.write(lease, key("A$index"), source, png)
    }
    clock += 1000
    val firstSavedAt = store.read(lease, key("A0"))!!.savedAtUnixMs
    clock += 1000
    store.write(lease, key("NEW"), source, png)
    assertEquals(TokenIconDiskCache.MAX_ENTRIES, directory.listFiles()!!.size)
    assertNull(store.read(lease, key("A1")))
    assertEquals(firstSavedAt, store.read(lease, key("A0"))!!.savedAtUnixMs)
    assertNotNull(store.read(lease, key("NEW")))
  }

  @Test fun byteBudgetIncludesTheEnvelopeAndLeavesNoPendingFiles() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    repeat(330) { index ->
      clock += 1000
      store.write(lease, key("A$index"), source, largePng)
      val files = directory.listFiles()!!
      assertTrue(files.sumOf { it.length() } <= TokenIconDiskCache.MAX_BYTES)
      assertTrue(files.size <= TokenIconDiskCache.MAX_ENTRIES)
    }
    val files = directory.listFiles()!!
    assertTrue(files.all { it.name.endsWith(".icon") })
    assertTrue(files.all { it.length() > largePng.size })
    assertTrue(files.size < 330)
    assertNull(store.read(lease, key("A0")))
    assertNotNull(store.read(lease, key("A329")))
  }

  @Test fun removesInterruptedWriteDebrisAndDoesNotFollowSymlinks() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    store.write(lease, key(), source, png)
    File(directory, ".pending-interrupted.tmp").writeBytes(ByteArray(100))
    val outside = temporary.newFile("outside")
    outside.writeText("must stay")
    Files.createSymbolicLink(file(directory, key("EUR")).toPath(), outside.toPath())
    val reopened = cache(directory)
    assertNotNull(reopened.read(reopened.open(), key()))
    assertEquals(1, directory.listFiles()!!.size)
    assertEquals("must stay", outside.readText())
  }

  @Test fun ordinaryCloseAndModuleInvalidationKeepBytesButRevokeOnlyTheirOwnLeases() {
    val directory = temporary.newFolder("cache")
    val first = cache(directory)
    val other = cache(directory)
    val firstLease = first.open()
    val otherLease = other.open()
    first.write(firstLease, key(), source, png)
    first.revoke(firstLease, false)
    rejected { first.write(firstLease, key(), source, png) }
    assertNotNull(other.read(otherLease, key()))
    val closingLease = first.open()
    first.invalidate()
    rejected { first.open() }
    rejected { first.write(closingLease, key(), source, png) }
    assertNotNull(other.read(otherLease, key()))
  }

  @Test fun clearRevokesEveryModuleAndQueuedOpenCannotResurrectThePriorGeneration() {
    val directory = temporary.newFolder("cache")
    val first = cache(directory)
    val other = cache(directory)
    val firstLease = first.open()
    val otherLease = other.open()
    first.write(firstLease, key(), source, png)
    val queuedOpenGeneration = first.openGeneration()
    other.revoke("", true)
    other.clear()
    rejected { first.write(firstLease, key(), source, png) }
    rejected { other.write(otherLease, key(), source, png) }
    rejected { first.open(queuedOpenGeneration) }
    assertNull(first.read(first.open(), key()))
  }

  @Test fun failedPrivacyPurgeStaysClosedUntilOpenCanRetryItSuccessfully() {
    val directory = temporary.newFolder("cache")
    val store = cache(directory)
    val lease = store.open()
    store.write(lease, key(), source, png)
    // A directory symlink forces purge to fail before any previous image can
    // be deleted, independent of the test runner's file-permission privileges.
    val held = File(temporary.root, "held-cache")
    assertTrue(directory.renameTo(held))
    Files.createSymbolicLink(directory.toPath(), held.toPath())
    store.revoke(lease, true)
    rejected { store.clear() }
    val anotherModule = cache(directory)
    rejected { anotherModule.open() }
    assertTrue(file(held, key()).exists())
    rejected { store.read(lease, key()) }
    Files.delete(directory.toPath())
    assertTrue(held.renameTo(directory))
    val newLease = anotherModule.open()
    assertNull(anotherModule.read(newLease, key()))
    anotherModule.write(newLease, key(), source, png)
    store.clear() // The original queued clear has already been satisfied.
    assertNotNull(anotherModule.read(newLease, key()))
  }

  @Test fun privacyRevocationStopsAWriteAlreadyValidatingItsImage() {
    val directory = temporary.newFolder("cache")
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val writer = cache(directory) { bytes ->
      entered.countDown()
      check(release.await(5, TimeUnit.SECONDS))
      fixtureMime(bytes)
    }
    val lease = writer.open()
    val worker = Executors.newSingleThreadExecutor()
    try {
      val write = worker.submit { writer.write(lease, key(), source, png) }
      assertTrue(entered.await(5, TimeUnit.SECONDS))
      val closer = cache(directory)
      closer.revoke("", true)
      release.countDown()
      try {
        write.get(5, TimeUnit.SECONDS)
        fail("late write unexpectedly committed")
      } catch (error: ExecutionException) {
        assertTrue(error.cause is IllegalStateException)
      }
      closer.clear()
      assertEquals(0, directory.listFiles()!!.size)
    } finally {
      release.countDown()
      worker.shutdownNow()
    }
  }

  @Test fun serializesFilesystemWorkAcrossOverlappingModuleInstances() {
    val directory = temporary.newFolder("cache")
    val firstEntered = CountDownLatch(1)
    val secondEntered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val active = AtomicInteger()
    val maximumActive = AtomicInteger()
    val first = cache(directory) { bytes ->
      val running = active.incrementAndGet()
      maximumActive.updateAndGet { maxOf(it, running) }
      firstEntered.countDown()
      check(release.await(5, TimeUnit.SECONDS))
      active.decrementAndGet()
      fixtureMime(bytes)
    }
    val second = cache(directory) { bytes ->
      val running = active.incrementAndGet()
      maximumActive.updateAndGet { maxOf(it, running) }
      secondEntered.countDown()
      active.decrementAndGet()
      fixtureMime(bytes)
    }
    val firstLease = first.open()
    val secondLease = second.open()
    val workers = Executors.newFixedThreadPool(2)
    try {
      val firstWrite = workers.submit { first.write(firstLease, key(), source, png) }
      assertTrue(firstEntered.await(5, TimeUnit.SECONDS))
      val secondWrite = workers.submit { second.write(secondLease, key("EUR"), source, png) }
      assertFalse(secondEntered.await(100, TimeUnit.MILLISECONDS))
      release.countDown()
      firstWrite.get(5, TimeUnit.SECONDS)
      secondWrite.get(5, TimeUnit.SECONDS)
      assertEquals(1, maximumActive.get())
      assertEquals(2, directory.listFiles()!!.size)
    } finally {
      release.countDown()
      workers.shutdownNow()
    }
  }
}
