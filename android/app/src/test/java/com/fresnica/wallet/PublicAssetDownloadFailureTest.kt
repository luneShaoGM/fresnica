package com.fresnica.wallet

import java.io.IOException
import java.net.ProtocolException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.nio.charset.CharacterCodingException
import javax.net.ssl.SSLHandshakeException
import org.junit.Assert.assertEquals
import org.junit.Test

class PublicAssetDownloadFailureTest {
  @Test fun onlyTemporaryDownloadFailuresPermitStaleFallback() {
    for (error in listOf(UnknownHostException("private message"), SocketTimeoutException("private message"), IOException("private message"))) {
      assertEquals(PublicAssetDownloadErrors.TRANSIENT, PublicAssetDownloadErrors.fromException(error))
    }
    for (status in listOf(429, 500, 502, 503, 599)) {
      assertEquals(PublicAssetDownloadErrors.TRANSIENT, PublicAssetDownloadErrors.httpStatus(status))
    }
    for (status in listOf(204, 301, 302, 304, 400, 401, 403, 404, 410)) {
      assertEquals(PublicAssetDownloadErrors.INVALID, PublicAssetDownloadErrors.httpStatus(status))
    }
  }

  @Test fun securityAndContentErrorsStayDistinctFromOfflineFailures() {
    for (error in listOf(BlockedPublicAssetEndpoint(), SSLHandshakeException("private hostname"), IOException(SSLHandshakeException("private hostname")))) {
      assertEquals(PublicAssetDownloadErrors.BLOCKED, PublicAssetDownloadErrors.fromException(error))
    }
    for (error in listOf(ProtocolException("private response"), CharacterCodingException(), IllegalArgumentException("private bytes"))) {
      assertEquals(PublicAssetDownloadErrors.INVALID, PublicAssetDownloadErrors.fromException(error))
    }
    assertEquals(PublicAssetDownloadErrors.CANCELLED,
      PublicAssetDownloadErrors.fromException(PublicAssetDownloadFailure(PublicAssetDownloadErrors.CANCELLED)))
    assertEquals(PublicAssetDownloadErrors.UNAVAILABLE,
      PublicAssetDownloadErrors.fromException(IllegalStateException("private diagnostic")))
  }
}
