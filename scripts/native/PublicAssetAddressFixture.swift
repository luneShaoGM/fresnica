import Foundation
import Network

@main
struct PublicAssetAddressFixture {
  static func main() {
    let blocked = [
      "127.0.0.1", "10.0.0.1", "172.16.4.1", "192.168.1.1",
      "100.64.0.1", "169.254.1.1", "0.0.0.1", "224.0.0.1",
      "198.18.0.1", "192.0.2.4", "198.51.100.2", "203.0.113.10",
      "::1", "::ffff:127.0.0.1", "fe80::1", "fd00::1",
      "2001:db8::1", "2002:c0a8:101::1",
    ]
    for ip in blocked {
      precondition(PublicAssetAddress.pinnedHost(numeric: ip) == nil,
                   "Unsafe endpoint was allowed: \(ip)")
    }
    for ip in ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"] {
      precondition(PublicAssetAddress.pinnedHost(numeric: ip) != nil,
                   "Public endpoint was rejected: \(ip)")
    }
    // Injection-style native resolver fixture: DNS returning only private,
    // mixed, or a rebinding candidate never produces an NWConnection target.
    precondition(PublicAssetAddress.vettedHost(resolvedAddresses: ["127.0.0.1"]) == nil)
    precondition(PublicAssetAddress.vettedHost(resolvedAddresses: ["8.8.8.8", "127.0.0.1"]) == nil)
    precondition(PublicAssetAddress.vettedHost(resolvedAddresses: ["10.0.0.1", "8.8.8.8"]) == nil)
    precondition(PublicAssetAddress.vettedHost(resolvedAddresses: ["8.8.8.8", "1.1.1.1"]) != nil)
    print("PASS public socket address fixture: \(blocked.count) blocked, 3 public")
  }
}
