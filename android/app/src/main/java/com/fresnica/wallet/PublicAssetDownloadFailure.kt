package com.fresnica.wallet

import java.io.IOException
import java.net.ProtocolException
import java.nio.charset.CharacterCodingException
import javax.net.ssl.SSLException

// Only fixed, non-sensitive codes cross the bridge. Temporary transport
// failure may use stale icons; security/content failures must not do so.
internal class PublicAssetDownloadFailure(val code: String) : Exception()

internal object PublicAssetDownloadErrors {
  const val UNAVAILABLE = "asset-download-unavailable"
  const val TRANSIENT = "asset-download-transient"
  const val BLOCKED = "asset-download-blocked"
  const val INVALID = "asset-download-invalid"
  const val CANCELLED = "asset-download-cancelled"

  fun httpStatus(status: Int): String =
    if (status == 429 || status in 500..599) TRANSIENT else INVALID

  fun fromException(error: Exception): String {
    // Some HTTP implementations wrap DNS/TLS errors in an IOException.
    if (generateSequence(error as Throwable?) { it.cause }.take(8).any {
      it is BlockedPublicAssetEndpoint || it is SSLException
    }) return BLOCKED
    return when (error) {
      is PublicAssetDownloadFailure -> error.code
      is ProtocolException, is CharacterCodingException, is IllegalArgumentException -> INVALID
      is IOException -> TRANSIENT
      else -> UNAVAILABLE
    }
  }
}
