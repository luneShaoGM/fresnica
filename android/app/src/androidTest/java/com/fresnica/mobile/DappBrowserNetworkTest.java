package com.fresnica.mobile;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.PermissionRequest;
import androidx.webkit.ProxyConfig;
import androidx.webkit.ProxyController;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLServerSocket;
import com.reactnativecommunity.webview.RNCWebChromeClient;

/** Actual Android WebView + local TLS receiver. No external site or wallet is used.
 * Tests the network mechanism, not native wallet product-flow acceptance.
 */
public final class DappBrowserNetworkTest extends Instrumentation {
  private Activity activity;
  private WebView webview;
  private DappTunnelProxy proxy;
  private SSLServerSocket receiver;
  private ServerSocket forbidden;
  private ServerSocket forbiddenV6;
  private final AtomicInteger forbiddenConnections = new AtomicInteger();
  private final List<String> received = Collections.synchronizedList(new ArrayList<>());
  private volatile CountDownLatch finished;
  private int passed = 0;
  private int failed = 0;

  @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }

  @Override public void onStart() {
    try {
      check(WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE), "proxy-unsupported");
      startReceivers();
      proxy = new DappTunnelProxy(host -> {
        if (host.equals("private.fixture.example")) return new InetAddress[] { InetAddress.getByName("127.0.0.1") };
        if (host.equals("mixed.fixture.example")) return new InetAddress[] {
            InetAddress.getByName("8.8.8.8"), InetAddress.getByName("10.0.0.1") };
        if (!host.equals("public.fixture.example") && !host.equals("redirect.fixture.example") &&
            !host.equals("untrusted.fixture.example"))
          throw new java.io.IOException("fixture-host-only");
        return new InetAddress[] { InetAddress.getByName("8.8.8.8") };
      }, (address, port) -> {
        check(address.getHostAddress().equals("8.8.8.8"), "unvalidated-dial");
        check(port == receiver.getLocalPort(), "unexpected-fixture-port");
        return new Socket("127.0.0.1", port);
      });
      CountDownLatch installed = new CountDownLatch(1);
      runOnMainSync(() -> ProxyController.getInstance().setProxyOverride(new ProxyConfig.Builder()
          .addProxyRule("http://127.0.0.1:" + proxy.port()).removeImplicitRules().build(),
          Runnable::run, installed::countDown));
      check(installed.await(10, TimeUnit.SECONDS), "proxy-ack-timeout");
      Intent intent = new Intent(getTargetContext(), DappBrowserFixtureActivity.class);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      activity = startActivitySync(intent);
      runOnMainSync(() -> {
        webview = new WebView(activity);
        webview.getSettings().setJavaScriptEnabled(true);
        webview.getSettings().setAllowFileAccess(false);
        webview.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Deliberately no navigation policy here: prove the proxy itself stops requests.
        // No SSL-error override: WebView must validate the debug-only fixture CA.
        webview.setWebViewClient(new WebViewClient() {
          @Override public void onPageFinished(WebView view, String url) { finished.countDown(); }
          @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) finished.countDown();
          }
        });
        activity.setContentView(webview);
      });

      test("address-policy", () -> {
        String[] blocked = {"0.1.2.3", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254",
            "172.31.0.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1",
            "224.0.0.1", "::1", "fc00::1", "fe80::1", "64:ff9b::7f00:1", "2001:db8::1", "2002:7f00:1::1"};
        for (String ip : blocked) check(!DappTunnelProxy.isPublicAddress(InetAddress.getByName(ip)), "allowed:" + ip);
        check(DappTunnelProxy.isPublicAddress(InetAddress.getByName("8.8.8.8")), "blocked-public-v4");
        check(DappTunnelProxy.isPublicAddress(InetAddress.getByName("2606:4700:4700::1111")), "blocked-public-v6");
      });
      test("website-device-permissions-never-inherit-app-grants", () -> {
        AtomicInteger denied = new AtomicInteger();
        runOnMainSync(() -> {
          // A null WebView ensures the callback cannot inspect app permission or
          // ask Android for one. It must deny without any context/grant path.
          new RNCWebChromeClient(null).onPermissionRequest(new PermissionRequest() {
            @Override public android.net.Uri getOrigin() { return android.net.Uri.parse(base()); }
            @Override public String[] getResources() { return new String[] {
                RESOURCE_VIDEO_CAPTURE, RESOURCE_AUDIO_CAPTURE, RESOURCE_PROTECTED_MEDIA_ID, RESOURCE_MIDI_SYSEX }; }
            @Override public void grant(String[] resources) { throw new AssertionError("website-device-granted"); }
            @Override public void deny() { denied.incrementAndGet(); }
          });
        });
        check(denied.get() == 1, "website-device-permission-not-denied");
      });
      test("raw-proxy-rejects-local-and-cleartext", () -> {
        String[] requests = {
            "CONNECT 127.0.0.1:443 HTTP/1.1",
            "CONNECT [::1]:443 HTTP/1.1",
            "CONNECT private.fixture.example:443 HTTP/1.1",
            "CONNECT mixed.fixture.example:443 HTTP/1.1",
            "CONNECT localhost:443 HTTP/1.1",
            "GET http://public.fixture.example/ HTTP/1.1" };
        for (String request : requests) {
          try (Socket client = new Socket("127.0.0.1", proxy.port())) {
            client.setSoTimeout(3000);
            client.getOutputStream().write((request + "\r\nHost: fixture\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
            byte[] response = new byte[256];
            int count = client.getInputStream().read(response);
            check(count > 0 && new String(response, 0, count, StandardCharsets.US_ASCII).startsWith("HTTP/1.1 403"),
                "proxy-did-not-deny:" + request);
          }
        }
      });
      test("https-get-and-post", () -> {
        load(base() + "/start");
        check(received.contains("GET /start "), "get-not-received");
        post(base() + "/accepted");
        check(received.contains("POST /accepted value=fixture"), "post-body-not-preserved:" + received);
      });
      test("post-loopback-https", () -> blockedPost("https://127.0.0.1:" + forbidden.getLocalPort() + "/blocked"));
      test("post-loopback-http", () -> blockedPost("http://127.0.0.1:" + forbidden.getLocalPort() + "/blocked"));
      test("post-ipv6-loopback", () -> blockedPost("https://[::1]:" + forbiddenV6.getLocalPort() + "/blocked"));
      test("post-private-dns", () -> blockedPost("https://private.fixture.example:" + forbidden.getLocalPort() + "/blocked"));
      test("post-mixed-dns", () -> blockedPost("https://mixed.fixture.example:" + forbidden.getLocalPort() + "/blocked"));
      test("get-redirect-to-loopback", () -> { load(base() + "/redirect"); noForbidden(); });
      test("post-307-to-loopback", () -> {
        load(base() + "/start");
        post(base() + "/redirect");
        check(received.contains("POST /redirect value=fixture"), "initial-post-missing");
        noForbidden();
      });
      test("https-cross-origin-redirect", () -> {
        load(base() + "/public-redirect");
        check(received.contains("GET /destination "), "public-redirect-failed:" + received);
      });
      test("tls-certificate-verification-remains-enforced", () -> {
        load("https://untrusted.fixture.example:" + receiver.getLocalPort() + "/invalid-cert");
        check(!received.contains("GET /invalid-cert "), "invalid-tls-request-arrived");
      });
      test("same-origin-fetch-post", () -> {
        load(base() + "/start");
        fetch(base() + "/xhr");
        check(received.contains("POST /xhr payload"), "fetch-post-not-received");
      });
      test("fetch-to-local-target", () -> {
        load(base() + "/start");
        fetch("https://127.0.0.1:" + forbidden.getLocalPort() + "/xhr");
        noForbidden();
      });
      test("proxy-failure-has-no-direct-fallback", () -> {
        proxy.close();
        load("https://127.0.0.1:" + forbidden.getLocalPort() + "/dead-proxy");
        noForbidden();
      });
      test("production-dns-dial-and-tls", () -> {
        proxy = new DappTunnelProxy();
        CountDownLatch ack = new CountDownLatch(1);
        runOnMainSync(() -> ProxyController.getInstance().setProxyOverride(new ProxyConfig.Builder()
            .addProxyRule("http://127.0.0.1:" + proxy.port()).removeImplicitRules().build(),
            Runnable::run, ack::countDown));
        check(ack.await(10, TimeUnit.SECONDS), "production-proxy-ack-timeout");
        load("https://example.com/");
        check(evaluateBoolean("document.title === 'Example Domain'"), "public-page-not-loaded");
      });
    } catch (Throwable error) {
      failed++;
      Bundle status = new Bundle();
      status.putString("stream", "\nSETUP FAILED: " + error + "\n");
      sendStatus(-1, status);
    } finally {
      runOnMainSync(() -> { if (webview != null) webview.destroy(); if (activity != null) activity.finish(); });
      if (proxy != null) proxy.close();
      try {
        if (receiver != null) receiver.close();
        if (forbidden != null) forbidden.close();
        if (forbiddenV6 != null) forbiddenV6.close();
      } catch (Exception ignored) { }
      Bundle result = new Bundle();
      result.putString("stream", "\nDAPP_NATIVE_NETWORK: passed=" + passed + " failed=" + failed +
          " forbiddenConnections=" + forbiddenConnections.get() + "\n");
      result.putBoolean("success", failed == 0);
      finish(failed == 0 ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
    }
  }

  private interface Case { void run() throws Exception; }
  private void test(String name, Case body) {
    Bundle status = new Bundle();
    status.putString("class", getClass().getName());
    status.putString("test", name);
    status.putInt("numtests", 17);
    status.putInt("current", passed + failed + 1);
    sendStatus(1, status);
    try { body.run(); passed++; status.putString("stream", "\nPASS " + name + "\n"); sendStatus(0, status); }
    catch (Throwable error) { failed++; status.putString("stack", error.toString());
      status.putString("stream", "\nFAIL " + name + ": " + error + "\n"); sendStatus(-2, status); }
  }

  private static void check(boolean ok, String error) { if (!ok) throw new AssertionError(error); }
  private String base() { return "https://public.fixture.example:" + receiver.getLocalPort(); }

  private void load(String url) throws Exception {
    finished = new CountDownLatch(1);
    runOnMainSync(() -> webview.loadUrl(url));
    check(finished.await(15, TimeUnit.SECONDS), "navigation-timeout:" + url);
  }

  private void post(String url) throws Exception {
    finished = new CountDownLatch(1);
    String script = "document.body.innerHTML='<form method=POST action=\"" + url +
        "\"><input name=value value=fixture></form>';document.forms[0].submit();";
    runOnMainSync(() -> webview.evaluateJavascript(script, null));
    check(finished.await(15, TimeUnit.SECONDS), "post-timeout:" + url);
  }

  private void blockedPost(String target) throws Exception { load(base() + "/start"); post(target); noForbidden(); }
  private void fetch(String url) throws Exception {
    runOnMainSync(() -> webview.evaluateJavascript("window.fixtureDone=false;fetch('" + url +
        "',{method:'POST',body:'payload'}).then(()=>window.fixtureDone=true,()=>window.fixtureDone=true);", null));
    long deadline = System.currentTimeMillis() + 10000;
    while (System.currentTimeMillis() < deadline) {
      if (evaluateBoolean("window.fixtureDone===true")) return;
      Thread.sleep(50);
    }
    throw new AssertionError("fetch-timeout");
  }

  private boolean evaluateBoolean(String script) throws Exception {
    CountDownLatch evaluated = new CountDownLatch(1);
    boolean[] result = {false};
    runOnMainSync(() -> webview.evaluateJavascript(script, value -> {
      result[0] = "true".equals(value);
      evaluated.countDown();
    }));
    check(evaluated.await(3, TimeUnit.SECONDS), "javascript-timeout");
    return result[0];
  }
  private void noForbidden() throws Exception {
    Thread.sleep(300);
    check(forbiddenConnections.get() == 0, "forbidden-receiver-was-contacted");
  }

  private void startReceivers() throws Exception {
    KeyStore keys = KeyStore.getInstance("PKCS12");
    try (InputStream asset = getContext().getAssets().open("dapp-fixture.p12")) {
      keys.load(asset, "fixture-only".toCharArray());
    }
    KeyManagerFactory managers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
    managers.init(keys, "fixture-only".toCharArray());
    SSLContext tls = SSLContext.getInstance("TLS");
    tls.init(managers.getKeyManagers(), null, null);
    receiver = (SSLServerSocket) tls.getServerSocketFactory().createServerSocket(
        0, 16, InetAddress.getByName("127.0.0.1"));
    forbidden = new ServerSocket(0, 16, InetAddress.getByName("127.0.0.1"));
    forbiddenV6 = new ServerSocket(0, 16, InetAddress.getByName("::1"));
    for (ServerSocket sentinel : new ServerSocket[] { forbidden, forbiddenV6 }) {
      Thread blocked = new Thread(() -> {
        while (!sentinel.isClosed()) {
          try (Socket unexpected = sentinel.accept()) { forbiddenConnections.incrementAndGet(); }
          catch (Exception ignored) { break; }
        }
      });
      blocked.setDaemon(true);
      blocked.start();
    }
    Thread server = new Thread(() -> {
      while (!receiver.isClosed()) {
        try {
          Socket socket = receiver.accept();
          Thread request = new Thread(() -> respond(socket));
          request.setDaemon(true);
          request.start();
        } catch (Exception stopped) { break; }
      }
    });
    server.setDaemon(true);
    server.start();
  }

  private void respond(Socket socket) {
    try (Socket connection = socket) {
      connection.setSoTimeout(5000);
      InputStream input = connection.getInputStream();
      ByteArrayOutputStream header = new ByteArrayOutputStream();
      String text = "";
      while (header.size() < 16384) {
        int value = input.read(); if (value == -1) return; header.write(value);
        text = header.toString("US-ASCII"); if (text.endsWith("\r\n\r\n")) break;
      }
      String[] request = text.split("\r\n")[0].split(" ");
      int length = 0;
      for (String line : text.split("\r\n")) {
        if (line.toLowerCase(java.util.Locale.ROOT).startsWith("content-length:"))
          length = Integer.parseInt(line.substring(line.indexOf(':') + 1).trim());
      }
      check(length >= 0 && length <= 4096, "fixture-body-too-large");
      byte[] body = new byte[length];
      int read = 0;
      while (read < length) { int count = input.read(body, read, length - read); if (count < 0) return; read += count; }
      received.add(request[0] + " " + request[1] + " " + new String(body, StandardCharsets.UTF_8));
      String response;
      if (request[1].equals("/redirect")) {
        response = "HTTP/1.1 307 Temporary Redirect\r\nLocation: https://127.0.0.1:" + forbidden.getLocalPort() +
            "/blocked\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
      } else if (request[1].equals("/public-redirect")) {
        response = "HTTP/1.1 302 Found\r\nLocation: https://redirect.fixture.example:" + receiver.getLocalPort() +
            "/destination\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
      } else {
        String html = "<!doctype html><title>Local fixture</title><body>fixture</body>";
        response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: " + html.length() +
            "\r\nConnection: close\r\n\r\n" + html;
      }
      connection.getOutputStream().write(response.getBytes(StandardCharsets.US_ASCII));
    } catch (Exception ignored) { /* Includes deliberately rejected TLS sessions. */ }
  }
}
