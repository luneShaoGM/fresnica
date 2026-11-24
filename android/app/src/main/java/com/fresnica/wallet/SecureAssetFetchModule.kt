package com.fresnica.wallet

import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.Proxy
import java.net.URL
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
  private val cacheExecutor = Executors.newSingleThreadExecutor()
  // Android's private cache directory is excluded from Auto Backup and can
  // be reclaimed by the OS. Only validated public token icons live here.
  private val iconCache = TokenIconDiskCache(File(context.cacheDir, "token-icons-v1"))
  @Volatile private var retired = false

  override fun getName(): String = "SecureAssetFetch"

  @ReactMethod
  fun fetch(urlString: String, kind: String, requestId: String, promise: Promise) {
    val url = PublicAssetValidation.safeAssetUrl(urlString)
    val invalid = when {
      retired -> CANCELLED
      url == null -> BLOCKED
      kind != "icon" && kind != "avatar" && kind != "text" -> INVALID
      !requestId.matches(Regex("[A-Za-z0-9-]{1,48}")) -> INVALID
      else -> null
    }
    if (invalid != null || url == null) {
      promise.reject(invalid ?: BLOCKED, invalid ?: BLOCKED)
      return
    }
    val request = Request(promise)
    val admissionFailure = synchronized(requests) {
      when {
        retired -> CANCELLED
        requests.containsKey(requestId) -> INVALID
        requests.size >= 2 -> TRANSIENT
        else -> { requests[requestId] = request; null }
      }
    }
    if (admissionFailure != null) {
      promise.reject(admissionFailure, admissionFailure)
      return
    }
    try {
      request.deadline = watchdog.schedule({ abort(requestId, TRANSIENT, request) }, 8, TimeUnit.SECONDS)
      request.future = executor.submit {
        try {
          val bytes = fetchBounded(url, kind, request)
          if (request.cancelled.get()) throw PublicAssetDownloadFailure(CANCELLED)
          val result = Arguments.createMap()
          if (kind != "text") {
            val mime = PublicAssetValidation.checkedImageMime(bytes) ?: throw PublicAssetDownloadFailure(INVALID)
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
        } catch (error: Exception) {
          val code = PublicAssetDownloadErrors.fromException(error)
          if (requests.remove(requestId, request)) request.promise.reject(code, code)
        } finally {
          request.deadline?.cancel(false)
          request.call?.cancel()
        }
      }
    } catch (_: Exception) {
      abort(requestId, if (retired) CANCELLED else TRANSIENT, request)
    }
  }

  @ReactMethod
  fun cancel(requestId: String) = abort(requestId, CANCELLED)

  private fun abort(requestId: String, code: String, expected: Request? = null) {
    val request = if (expected == null) requests.remove(requestId) ?: return else {
      if (!requests.remove(requestId, expected)) return
      expected
    }
    request.cancelled.set(true)
    request.deadline?.cancel(false)
    request.call?.cancel()
    request.future?.cancel(true)
    request.promise.reject(code, code)
  }

  @ReactMethod
  fun openIconCache(promise: Promise) {
    try {
      check(!retired)
      val generation = iconCache.openGeneration()
      cacheTask(promise) { iconCache.open(generation) }
    } catch (_: Exception) {
      promise.reject(CACHE_FAIL, CACHE_FAIL)
    }
  }

  @ReactMethod
  fun readIconCache(sessionId: String, key: String, promise: Promise) = cacheTask(promise) {
    val entry = iconCache.read(sessionId, key)
    if (entry == null) null else Arguments.createMap().apply {
      putString("mimeType", entry.mimeType)
      putString("base64", Base64.encodeToString(entry.bytes, Base64.NO_WRAP))
      putString("sourceUrl", entry.sourceUrl)
      putDouble("savedAtUnixMs", entry.savedAtUnixMs.toDouble())
    }
  }

  @ReactMethod
  fun writeIconCache(sessionId: String, key: String, sourceUrl: String, base64: String, promise: Promise) {
    if (base64.length !in 4..MAX_ICON_BASE64) {
      promise.reject(CACHE_FAIL, CACHE_FAIL)
      return
    }
    cacheTask(promise) {
      check(base64.length % 4 == 0 && base64.all {
        it in 'A'..'Z' || it in 'a'..'z' || it in '0'..'9' || it == '+' || it == '/' || it == '='
      })
      val bytes = Base64.decode(base64, Base64.NO_WRAP)
      check(Base64.encodeToString(bytes, Base64.NO_WRAP) == base64)
      iconCache.write(sessionId, key, sourceUrl, bytes)
      null
    }
  }

  @ReactMethod
  fun removeIconCache(sessionId: String, key: String, promise: Promise) = cacheTask(promise) {
    iconCache.remove(sessionId, key)
    null
  }

  @ReactMethod
  fun closeIconCache(sessionId: String, clearAll: Boolean, promise: Promise) {
    // Revoke before queued IO can run. A writer checks this same lease under
    // its rename lock, so a late response cannot repopulate an opted-out cache.
    iconCache.revoke(sessionId, clearAll)
    if (clearAll) cacheTask(promise) { iconCache.clear(); null } else promise.resolve(null)
  }

  private fun cacheTask(promise: Promise, operation: () -> Any?) {
    try {
      check(!retired)
      cacheExecutor.execute {
        try {
          promise.resolve(operation())
        } catch (_: Exception) {
          promise.reject(CACHE_FAIL, CACHE_FAIL)
        }
      }
    } catch (_: Exception) {
      promise.reject(CACHE_FAIL, CACHE_FAIL)
    }
  }

  override fun invalidate() {
    retired = true
    iconCache.invalidate()
    requests.keys.toList().forEach(::cancel)
    executor.shutdownNow()
    watchdog.shutdownNow()
    // Let queued cache tasks settle their promises after leases are revoked.
    cacheExecutor.shutdown()
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
      throw PublicAssetDownloadFailure(CANCELLED)
    }
    return call.execute().use { response ->
      if (response.code != 200) throw PublicAssetDownloadFailure(PublicAssetDownloadErrors.httpStatus(response.code))
      val body = response.body ?: throw PublicAssetDownloadFailure(INVALID)
      val encoding = response.header("Content-Encoding")
      if (encoding != null && !encoding.equals("identity", ignoreCase = true) ||
          body.contentLength() > limit || body.contentLength() < -1) {
        throw PublicAssetDownloadFailure(INVALID)
      }
      val out = ByteArrayOutputStream(minOf(limit, 4096))
      body.byteStream().use { input ->
        val chunk = ByteArray(4096)
        while (true) {
          if (request.cancelled.get()) throw PublicAssetDownloadFailure(CANCELLED)
          val count = input.read(chunk)
          if (count < 0) break
          if (out.size() + count > limit) throw PublicAssetDownloadFailure(INVALID)
          out.write(chunk, 0, count)
        }
      }
      if (request.cancelled.get()) throw PublicAssetDownloadFailure(CANCELLED)
      out.toByteArray()
    }
  }

  private companion object {
    const val TRANSIENT = PublicAssetDownloadErrors.TRANSIENT
    const val BLOCKED = PublicAssetDownloadErrors.BLOCKED
    const val INVALID = PublicAssetDownloadErrors.INVALID
    const val CANCELLED = PublicAssetDownloadErrors.CANCELLED
    const val CACHE_FAIL = "asset-cache-unavailable"
    const val MAX_ICON_BASE64 = ((TokenIconDiskCache.MAX_IMAGE_BYTES + 2) / 3) * 4
  }
}
