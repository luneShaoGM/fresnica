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
    for answers in [["127.0.0.1"], ["8.8.8.8", "127.0.0.1"], ["10.0.0.1", "8.8.8.8"],
                    Array(repeating: "8.8.8.8", count: 33)] {
      guard case .blocked = PublicAssetAddress.resolve(hostname: "cdn.example.org", lookup: { _ in answers })
      else { preconditionFailure("Rejected DNS answer must be classified as blocked") }
    }
    for answers: [String]? in [nil, []] {
      guard case .unavailable = PublicAssetAddress.resolve(hostname: "cdn.example.org", lookup: { _ in answers })
      else { preconditionFailure("Lookup failure or no answers must be retryable") }
    }
    let publicAnswers = PublicAssetAddress.resolve(hostname: "cdn.example.org", lookup: { _ in ["8.8.8.8", "1.1.1.1"] })
    guard case .pinned(let host) = publicAnswers, host == PublicAssetAddress.pinnedHost(numeric: "8.8.8.8")
    else { preconditionFailure("Public answers must pin the first numeric target") }
    print("PASS public socket address fixture: numeric filtering, DNS outcomes, and public address pinning")
  }
}
