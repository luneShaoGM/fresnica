package com.fresnica.wallet

import android.graphics.BitmapFactory
import java.io.ByteArrayInputStream
import java.net.URL

// The downloader and persistent icon cache must accept exactly the same media.
internal object PublicAssetValidation {
  fun checkedImageMime(bytes: ByteArray): String? {
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
    val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    decoded.recycle()
    return if (png) "image/png" else "image/jpeg"
  }

  // Reject credentials, IP literals, local domains, custom ports and fragments
  // before DNS. PublicAssetDns separately pins the actual socket addresses.
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
