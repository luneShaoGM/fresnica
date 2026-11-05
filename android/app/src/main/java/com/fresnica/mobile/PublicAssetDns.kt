package com.fresnica.mobile

import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns

// Reuse the reviewed Android dApp tunnel's public-IP classification. OkHttp
// connects to exactly the InetAddress objects returned from this resolver:
// unlike a preflight DNS lookup, no second hostname resolution is possible.
internal class PublicAssetDns(private val upstream: Dns = Dns.SYSTEM) : Dns {
  override fun lookup(hostname: String): List<InetAddress> {
    val addresses = upstream.lookup(hostname)
    // Match the existing DappTunnelProxy invariant: mixed public/private
    // answers fail closed instead of silently picking one address.
    if (addresses.isEmpty() || addresses.any { !DappTunnelProxy.isPublicAddress(it) }) {
      throw UnknownHostException("non-public asset endpoint")
    }
    return addresses
  }
}
