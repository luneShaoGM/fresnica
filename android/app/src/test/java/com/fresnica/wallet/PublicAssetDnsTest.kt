package com.fresnica.wallet

import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import okhttp3.Call
import okhttp3.Connection
import okhttp3.Dns
import okhttp3.EventListener
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class PublicAssetDnsTest {
  private fun ip(value: String): InetAddress = InetAddress.getByName(value)

  @Test fun rejectsLocalPrivateAndReservedEndpoints() {
    for (value in listOf(
      "127.0.0.1", "10.0.0.1", "172.16.3.1", "192.168.1.1",
      "100.64.1.2", "169.254.4.1", "0.0.0.1", "224.0.0.1",
      "198.18.0.1", "192.0.2.10", "198.51.100.10", "203.0.113.10",
      "::1", "::ffff:127.0.0.1", "fe80::1", "fd00::1",
      "2001:db8::1", "2002:c0a8:101::1",
    )) {
      assertFalse(value, DappTunnelProxy.isPublicAddress(ip(value)))
    }
    assertTrue(DappTunnelProxy.isPublicAddress(ip("8.8.8.8")))
    assertTrue(DappTunnelProxy.isPublicAddress(ip("2606:4700:4700::1111")))
  }

  @Test fun rejectsMixedDnsResultsAndAcceptsOnlyPublicSocketAddresses() {
    val mixed = PublicAssetDns(object : Dns { override fun lookup(hostname: String) = listOf(ip("127.0.0.1"), ip("8.8.8.8")) })
    try {
      mixed.lookup("cdn.example.org")
      fail("mixed public/private DNS answers must fail closed")
    } catch (_: UnknownHostException) {
    }
    val public = PublicAssetDns(object : Dns { override fun lookup(hostname: String) = listOf(ip("8.8.8.8"), ip("2606:4700:4700::1111")) })
    assertEquals(2, public.lookup("cdn.example.org").size)
  }

  @Test fun aPublicLookingHostnameResolvingToLoopbackCannotStartAConnection() {
    val connections = AtomicInteger()
    val client = OkHttpClient.Builder()
      .dns(PublicAssetDns(object : Dns { override fun lookup(hostname: String) = listOf(ip("127.0.0.1"), ip("192.168.1.1")) }))
      .proxy(Proxy.NO_PROXY)
      .callTimeout(1, TimeUnit.SECONDS)
      .eventListener(object : EventListener() {
        override fun connectStart(call: Call, inetSocketAddress: InetSocketAddress, proxy: Proxy) {
          connections.incrementAndGet()
        }
      })
      .build()
    try {
      client.newCall(Request.Builder().url("https://public-looking.example.org/a.png").build()).execute().use {}
      fail("private DNS result unexpectedly established a connection")
    } catch (_: UnknownHostException) {
      // DNS was rejected before OkHttp's connection routing.
    }
    assertEquals("no connection to a private endpoint may start", 0, connections.get())
  }
}
