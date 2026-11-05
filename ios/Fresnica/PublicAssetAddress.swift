import Foundation
import Network
import Darwin

// Numeric socket destination selected after DNS. Reject private, reserved,
// loopback, multicast, link-local and transition ranges *before* NWConnection
// creation. NWConnection is only ever given this vetted numeric endpoint.
enum PublicAssetAddress {
  static func isGlobal(_ bytes: [UInt8]) -> Bool {
    if bytes.count == 4 {
      let a = Int(bytes[0]), b = Int(bytes[1]), c = Int(bytes[2])
      return !(
        a == 0 || a == 10 || a == 127 || a >= 224 ||
        (a == 100 && (64...127).contains(b)) ||
        (a == 169 && b == 254) ||
        (a == 172 && (16...31).contains(b)) ||
        (a == 192 && (
          b == 168 || b == 0 && (c == 0 || c == 2) ||
          b == 88 && c == 99 || b == 31 && c == 196 ||
          b == 52 && c == 193 || b == 175 && c == 48
        )) ||
        (a == 198 && ((18...19).contains(b) || b == 51 && c == 100)) ||
        (a == 203 && b == 0 && c == 113)
      )
    }
    guard bytes.count == 16, (0x20...0x3f).contains(bytes[0]) else { return false }
    if bytes[0] == 0x20 && bytes[1] == 0x01 &&
        (bytes[2] < 0x02 || bytes[2] == 0x0d && bytes[3] == 0xb8) { return false }
    if bytes[0] == 0x20 && bytes[1] == 0x02 { return false } // 6to4
    if bytes[0] == 0x3f && bytes[1] == 0xff && bytes[2] < 0x10 { return false }
    return true
  }

  static func pinnedHost(numeric: String) -> NWEndpoint.Host? {
    var ipv4 = in_addr()
    if inet_pton(AF_INET, numeric, &ipv4) == 1 {
      let bytes = withUnsafeBytes(of: ipv4) { Array($0) }
      guard isGlobal(bytes), let address = IPv4Address(numeric) else { return nil }
      return .ipv4(address)
    }
    var ipv6 = in6_addr()
    if inet_pton(AF_INET6, numeric, &ipv6) == 1 {
      let bytes = withUnsafeBytes(of: ipv6) { Array($0) }
      guard isGlobal(bytes), let address = IPv6Address(numeric) else { return nil }
      return .ipv6(address)
    }
    return nil
  }

  static func vettedHost(resolvedAddresses: [String]) -> NWEndpoint.Host? {
    guard !resolvedAddresses.isEmpty, resolvedAddresses.count <= 32 else { return nil }
    var first: NWEndpoint.Host?
    for numeric in resolvedAddresses {
      // Match the existing Android tunnel rule: a mixed public/private DNS
      // result is rejected as a whole, even when its first A/AAAA is public.
      guard let candidate = pinnedHost(numeric: numeric) else { return nil }
      if first == nil { first = candidate }
    }
    return first
  }

  // Resolve once. Never hand the hostname to Network.framework for a second
  // DNS lookup. IPv4/IPv6 socket targets are selected from this approved set.
  static func resolve(hostname: String) -> NWEndpoint.Host? {
    var hints = addrinfo()
    hints.ai_family = AF_UNSPEC
    hints.ai_socktype = SOCK_STREAM
    hints.ai_flags = AI_ADDRCONFIG
    var first: UnsafeMutablePointer<addrinfo>?
    guard getaddrinfo(hostname, "443", &hints, &first) == 0, let start = first else { return nil }
    defer { freeaddrinfo(start) }
    var current: UnsafeMutablePointer<addrinfo>? = start
    var addresses: [String] = []
    while let item = current {
      let entry = item.pointee
      if entry.ai_family == AF_INET || entry.ai_family == AF_INET6 {
        var numeric = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        guard getnameinfo(entry.ai_addr, entry.ai_addrlen, &numeric, socklen_t(numeric.count),
                          nil, 0, NI_NUMERICHOST) == 0 else { return nil }
        addresses.append(String(cString: numeric))
      }
      current = entry.ai_next
    }
    return vettedHost(resolvedAddresses: addresses)
  }
}
