package com.fresnica.wallet

import android.graphics.BitmapFactory
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.URL
import java.net.Proxy
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.Call
import okhttp3.ConnectionPool
import okhttp3.OkHttpClient
import okhttp3.Request as HttpRequest

// Only this native transport is authorized to download remote token icon bytes.
// Neither RN fetch/XHR nor RN Image is used for remote image requests.
class SecureAssetFetchModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private class Request(val promise: Promise) {
    val cancelled = AtomicBoolean(false)
    @Volatile var call: Call? = null
    @Volatile var future: Future<*>? = null
    @Volatile var deadline: ScheduledFuture<*>? = null
  }

  private val requests = ConcurrentHashMap<String, Request>()
  // OkHttp connects to PublicAssetDns' exact verified InetAddress list;
  // disabling proxies, redirects and pooled connections prevents bypass
  // through a different DNS lookup, proxy, or previously opened socket.
  private val http = OkHttpClient.Builder()
    .dns(PublicAssetDns())
    .proxy(Proxy.NO_PROXY)
    .followRedirects(false)
    .followSslRedirects(false)
    .retryOnConnectionFailure(false)
    .connectionPool(ConnectionPool(0, 1, TimeUnit.SECONDS))
    .callTimeout(8, TimeUnit.SECONDS)
    .connectTimeout(6, TimeUnit.SECONDS)
    .readTimeout(6, TimeUnit.SECONDS)
    .build()
  private val executor = Executors.newFixedThreadPool(2)
  private val watchdog = Executors.newSingleThreadScheduledExecutor()
  private var retired = false

  override fun getName(): String = "SecureAssetFetch"

  @ReactMethod
  fun fetch(urlString: String, kind: String, requestId: String, promise: Promise) {
    val url = safeAssetUrl(urlString)
    if (retired || url == null || kind != "icon" && kind != "avatar" && kind != "text" ||
        !requestId.matches(Regex("[A-Za-z0-9-]{1,48}")) || requests.size >= 2 ||
        requests.containsKey(requestId)) {
      promise.reject(FAIL, FAIL)
      return
    }
    val request = Request(promise)
    requests[requestId] = request
    request.deadline = watchdog.schedule({ cancel(requestId) }, 8, TimeUnit.SECONDS)
    request.future = executor.submit {
      try {
        val bytes = fetchBounded(url, kind, request)
        if (request.cancelled.get()) throw IllegalStateException("cancelled")
        val result = Arguments.createMap()
        if (kind != "text") {
          val mime = checkedImageMime(bytes) ?: throw IllegalArgumentException("invalid image")
          result.putString("mimeType", mime)
          result.putString("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
        } else {
          val text = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes)).toString()
          result.putString("text", text)
        }
        if (requests.remove(requestId, request)) request.promise.resolve(result)
      } catch (_: Exception) {
        if (requests.remove(requestId, request)) request.promise.reject(FAIL, FAIL)
      } finally {
        request.deadline?.cancel(false)
        request.call?.cancel()
      }
    }
  }

  @ReactMethod
  fun cancel(requestId: String) {
    val request = requests.remove(requestId) ?: return
    request.cancelled.set(true)
    request.deadline?.cancel(false)
    request.call?.cancel()
    request.future?.cancel(true)
    request.promise.reject(FAIL, FAIL)
  }

  override fun invalidate() {
    retired = true
    requests.keys.toList().forEach(::cancel)
    executor.shutdownNow()
    watchdog.shutdownNow()
    super.invalidate()
  }

  private fun fetchBounded(url: URL, kind: String, request: Request): ByteArray {
    val limit = when (kind) { "icon" -> 65_536; "avatar" -> 262_144; else -> 524_288 }
    val call = http.newCall(HttpRequest.Builder()
      .url(url)
      .header("Accept", if (kind != "text") "image/png,image/jpeg" else "application/json,text/plain")
      .header("Accept-Encoding", "identity")
      .get()
      .build())
    request.call = call
    if (request.cancelled.get()) {
      call.cancel()
      throw IllegalStateException("cancelled")
    }
    return call.execute().use { response ->
      val body = response.body ?: throw IllegalArgumentException("no body")
      val encoding = response.header("Content-Encoding")
      if (response.code != 200 ||
          encoding != null && !encoding.equals("identity", ignoreCase = true) ||
          body.contentLength() > limit || body.contentLength() < -1) {
        throw IllegalArgumentException("unsafe response")
      }
      val out = ByteArrayOutputStream(minOf(limit, 4096))
      body.byteStream().use { input ->
        val chunk = ByteArray(4096)
        while (true) {
          if (request.cancelled.get()) throw IllegalStateException("cancelled")
          val count = input.read(chunk)
          if (count < 0) break
          if (out.size() + count > limit) throw IllegalArgumentException("response too large")
          out.write(chunk, 0, count)
        }
      }
      if (request.cancelled.get()) throw IllegalStateException("cancelled")
      out.toByteArray()
    }
  }

  private fun checkedImageMime(bytes: ByteArray): String? {
    val png = bytes.size >= 24 && bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() &&
      bytes[2] == 0x4E.toByte() && bytes[3] == 0x47.toByte() &&
      bytes[4] == 0x0D.toByte() && bytes[5] == 0x0A.toByte() &&
      bytes[6] == 0x1A.toByte() && bytes[7] == 0x0A.toByte()
    val jpeg = bytes.size >= 4 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() &&
      bytes[2] == 0xFF.toByte()
    if (!png && !jpeg) return null
    val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeStream(ByteArrayInputStream(bytes), null, options)
    if (options.outWidth !in 1..512 || options.outHeight !in 1..512) return null
    // Reject truncated images with superficially valid headers before they
    // can enter the JS data-URI memory cache.
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    decoded.recycle()
    return if (png) "image/png" else "image/jpeg"
  }

  private companion object {
    const val FAIL = "asset-download-unavailable"

    // Reject credentials, IP literals, local domains, custom ports and
    // fragments before any DNS lookup or network connection.
    fun safeAssetUrl(text: String): URL? {
      if (text.length !in 12..2048) return null
      val url = try { URL(text) } catch (_: Exception) { return null }
      if (url.protocol != "https" || url.userInfo != null || url.ref != null ||
          url.port != -1 && url.port != 443) return null
      val host = url.host.lowercase()
      if (host.length !in 4..253 || !host.contains('.') ||
          host.endsWith(".local") || host.endsWith(".internal") ||
          host.endsWith(".test") || host.endsWith(".invalid") ||
          host.endsWith(".localhost") || host == "localhost" ||
          host.all { it.isDigit() || it == '.' } || host.contains(':')) return null
      val labels = host.split('.')
      if (labels.any {
          it.length !in 1..63 || it.first() == '-' || it.last() == '-' ||
            !it.all { char -> char in 'a'..'z' || char in '0'..'9' || char == '-' }
        } || labels.last().all { it.isDigit() }) return null
      return url
    }
  }
}
