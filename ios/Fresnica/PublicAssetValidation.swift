import Foundation
import ImageIO

// Shared by the native downloader and its private token-icon cache. A cached
// file is never trusted just because a previous download passed validation.
enum PublicAssetValidation {
  static func safeURL(_ value: String) -> URL? {
    guard value.count >= 12 && value.count <= 2048,
      value.trimmingCharacters(in: .whitespacesAndNewlines) == value,
      let components = URLComponents(string: value),
      components.scheme?.lowercased() == "https",
      components.user == nil, components.password == nil,
      components.fragment == nil,
      components.port == nil || components.port == 443,
      let host = components.host?.lowercased(),
      host.count >= 4, host.count <= 253, host.contains("."),
      !host.contains(":"), host != "localhost",
      !host.hasSuffix(".local"), !host.hasSuffix(".internal"),
      !host.hasSuffix(".test"), !host.hasSuffix(".invalid"),
      !host.hasSuffix(".localhost"),
      !host.allSatisfy({ $0.isNumber || $0 == "." })
    else { return nil }
    let labels = host.split(separator: ".", omittingEmptySubsequences: false)
    guard labels.allSatisfy({ label in
      label.count >= 1 && label.count <= 63 &&
        label.first != "-" && label.last != "-" &&
        label.allSatisfy({ ("a"..."z").contains(String($0)) || ("0"..."9").contains(String($0)) || $0 == "-" })
    }), let suffix = labels.last, suffix.contains(where: { !$0.isNumber })
    else { return nil }
    return components.url
  }

  static func imageMime(_ bytes: Data) -> String? {
    let signature: [UInt8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    let png = bytes.count >= 24 && Array(bytes.prefix(8)) == signature
    let jpeg = bytes.count >= 4 && Array(bytes.prefix(3)) == [0xff, 0xd8, 0xff]
    guard png || jpeg,
      let source = CGImageSourceCreateWithData(bytes as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
      CGImageSourceGetStatus(source) == .statusComplete,
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int,
      width >= 1 && width <= 512 && height >= 1 && height <= 512,
      CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCache: false] as CFDictionary) != nil
    else { return nil }
    return png ? "image/png" : "image/jpeg"
  }
}
