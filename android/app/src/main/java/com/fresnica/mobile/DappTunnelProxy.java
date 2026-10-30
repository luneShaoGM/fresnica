package com.fresnica.mobile;

import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** HTTPS tunnels only. TLS and certificate verification stay inside WebView.
 * The resolved, validated address is also the address used to connect: no second DNS lookup.
 */
final class DappTunnelProxy implements Closeable {
  interface Resolver { InetAddress[] resolve(String host) throws IOException; }
  interface Dialer { Socket connect(InetAddress address, int port) throws IOException; }

  private final ServerSocket listener;
  private final Resolver resolver;
  private final Dialer dialer;
  private final Set<Socket> active = ConcurrentHashMap.newKeySet();
  private final ThreadPoolExecutor workers = new ThreadPoolExecutor(
      0, 64, 30, TimeUnit.SECONDS, new SynchronousQueue<>(), runnable -> {
        Thread thread = new Thread(runnable, "dapp-tunnel");
        thread.setDaemon(true);
        return thread;
      });

  DappTunnelProxy() throws IOException {
    this(InetAddress::getAllByName, (address, port) -> {
      Socket socket = new Socket();
      try {
        socket.connect(new InetSocketAddress(address, port), 10000);
        return socket;
      } catch (IOException error) {
        socket.close();
        throw error;
      }
    });
  }

  // Native test seams; no JavaScript or navigation parameter can configure these.
  DappTunnelProxy(Resolver resolver, Dialer dialer) throws IOException {
    this.resolver = resolver;
    this.dialer = dialer;
    listener = new ServerSocket(0, 16, InetAddress.getByName("127.0.0.1"));
    Thread acceptor = new Thread(() -> {
      while (!listener.isClosed()) {
        try {
          Socket client = listener.accept();
          active.add(client);
          try {
            workers.execute(() -> serve(client));
          } catch (RuntimeException full) {
            client.close();
            active.remove(client);
          }
        } catch (IOException stopped) {
          close(); // Never clear the installed proxy: a dead listener fails closed.
        }
      }
    }, "dapp-proxy");
    acceptor.setDaemon(true);
    acceptor.start();
  }

  int port() { return listener.getLocalPort(); }

  private void serve(Socket client) {
    try (Socket local = client) {
      local.setSoTimeout(15000);
      String[] request = readHeaders(local.getInputStream()).split("\\r\\n", 2)[0].split(" ", -1);
      if (request.length != 3 || !request[0].equals("CONNECT") ||
          !(request[2].equals("HTTP/1.1") || request[2].equals("HTTP/1.0"))) {
        reject(local);
        return;
      }
      String target = request[1];
      int colon = target.lastIndexOf(':');
      if (colon <= 0) { reject(local); return; }
      String host = target.substring(0, colon).toLowerCase(Locale.ROOT);
      int port;
      try { port = Integer.parseInt(target.substring(colon + 1)); }
      catch (NumberFormatException invalid) { reject(local); return; }
      if (!isPublicHost(host) || port < 1 || port > 65535) { reject(local); return; }
      InetAddress[] addresses = resolver.resolve(host);
      if (addresses.length == 0) { reject(local); return; }
      // Mixed public/private answers fail closed, even if the first answer is public.
      for (InetAddress address : addresses) {
        if (!isPublicAddress(address)) { reject(local); return; }
      }
      try (Socket remote = dialer.connect(addresses[0], port)) {
        active.add(remote);
        if (listener.isClosed()) return;
        local.setSoTimeout(90000);
        remote.setSoTimeout(90000);
        // Reserve the reverse worker before acknowledging a usable tunnel.
        workers.execute(() -> {
          try { copy(remote.getInputStream(), local); }
          catch (IOException ignored) { /* Peer closed or idle timeout. */ }
          finally { closeSocket(local); closeSocket(remote); }
        });
        local.getOutputStream().write("HTTP/1.1 200 Connection Established\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
        copy(local.getInputStream(), remote);
      }
    } catch (IOException | RuntimeException unavailable) {
      // A failed DNS lookup, full worker pool or dead tunnel never falls back to DIRECT.
    } finally {
      active.removeIf(Socket::isClosed);
    }
  }

  private static String readHeaders(InputStream input) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    int matched = 0;
    while (bytes.size() < 8192) {
      int value = input.read();
      if (value < 0 || value > 127 || value == 0) throw new IOException("invalid-proxy-request");
      bytes.write(value);
      if ((matched == 0 || matched == 2) && value == '\r') matched++;
      else if ((matched == 1 || matched == 3) && value == '\n') matched++;
      else matched = value == '\r' ? 1 : 0;
      if (matched == 4) return bytes.toString(StandardCharsets.US_ASCII.name());
    }
    throw new IOException("proxy-headers-too-large");
  }

  static boolean isPublicHost(String host) {
    if (host.length() > 253 || host.endsWith(".") || host.matches("[0-9.]+")) return false;
    String[] labels = host.split("\\.", -1);
    if (labels.length < 2) return false;
    for (String label : labels) {
      if (label.length() > 63 || !label.matches("[a-z0-9](?:[a-z0-9-]*[a-z0-9])?") ||
          label.equals("localhost")) return false;
    }
    String suffix = labels[labels.length - 1];
    return !suffix.equals("localhost") && !suffix.equals("local") && !suffix.equals("internal") &&
        !suffix.equals("invalid") && !suffix.equals("test") && !suffix.equals("onion");
  }

  static boolean isPublicAddress(InetAddress address) {
    byte[] bytes = address.getAddress();
    if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress() ||
        address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
    int a = bytes[0] & 255;
    int b = bytes[1] & 255;
    if (bytes.length == 4) {
      int c = bytes[2] & 255;
      return !(a == 0 || a == 10 || a == 127 || a >= 224 ||
          (a == 100 && b >= 64 && b <= 127) || (a == 169 && b == 254) ||
          (a == 172 && b >= 16 && b <= 31) || (a == 192 && (b == 168 || (b == 88 && c == 99) ||
              (b == 0 && (c == 0 || c == 2)))) ||
          (a == 198 && (b == 18 || b == 19 || (b == 51 && c == 100))) ||
          (a == 203 && b == 0 && c == 113));
    }
    // Only global unicast IPv6; reject transition/special/documentation prefixes.
    if (bytes.length != 16 || (a & 224) != 32) return false;
    int c = bytes[2] & 255;
    int d = bytes[3] & 255;
    return !(a == 32 && ((b == 1 && (c < 2 || (c == 13 && d == 184))) || b == 2)) &&
        !(a == 63 && b == 255 && (c & 240) == 0);
  }

  private static void reject(Socket socket) throws IOException {
    socket.getOutputStream().write(
        "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
  }

  private static void copy(InputStream source, Socket destination) throws IOException {
    byte[] buffer = new byte[16384];
    int size;
    while ((size = source.read(buffer)) != -1) destination.getOutputStream().write(buffer, 0, size);
  }

  private static void closeSocket(Socket socket) {
    try { socket.close(); } catch (IOException ignored) { }
  }

  @Override public void close() {
    try { listener.close(); } catch (IOException ignored) { }
    for (Socket socket : active) closeSocket(socket);
    active.clear();
    workers.shutdownNow();
  }
}
