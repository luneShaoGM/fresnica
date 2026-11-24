import Foundation
import CoreGraphics
import ImageIO

// Repository/native-helper validation, not app or real-device acceptance.
// macOS: swiftc ios/Fresnica/PublicAssetValidation.swift \
//   ios/Fresnica/TokenIconDiskCache.swift scripts/native/TokenIconDiskCacheFixture.swift \
//   -o /tmp/fresnica-token-icon-cache-fixture && /tmp/fresnica-token-icon-cache-fixture
@main
struct TokenIconDiskCacheFixture {
  static let issuer = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
  static let sourceUrl = "https://cdn.example.org/icon.png"

  static func main() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("fresnica-icon-fixture-" + UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    let png = makeImage(width: 2, height: 2)
    let jpeg = makeImage(width: 2, height: 2, format: "public.jpeg")
    expect(PublicAssetValidation.imageMime(png) == "image/png", "valid PNG")
    expect(PublicAssetValidation.imageMime(jpeg) == "image/jpeg", "valid JPEG")
    expect(PublicAssetValidation.imageMime(makeImage(width: 513, height: 1)) == nil, "dimension limit")
    expect(PublicAssetValidation.imageMime(Data(png.prefix(24))) == nil, "truncated image")
    for url in ["http://cdn.example.org/a.png", "https://127.0.0.1/a.png", "https://private.local/a.png",
                "https://user:password@example.org/a.png", "https://example.org:444/a.png",
                "https://example.org/a.png#fragment"] {
      expect(PublicAssetValidation.safeURL(url) == nil, "unsafe source")
    }

    let directory = root.appendingPathComponent("restart")
    var date = Date(timeIntervalSince1970: 1_700_000_000)
    let cache = TokenIconDiskCache(directory: directory, now: { date })
    let session = try cache.open(owner: "session-one")
    let asset = key(code: "Usd")
    try cache.write(session: session, key: asset, sourceUrl: sourceUrl, base64: png.base64EncodedString())
    let original = try cache.read(session: session, key: asset)
    expect(original?.bytes == png && original?.sourceUrl == sourceUrl, "round trip")
    expect(original?.savedAtUnixMs == 1_700_000_000_000, "freshness timestamp")
    let backup = try directory.resourceValues(forKeys: [.isExcludedFromBackupKey])
    expect(backup.isExcludedFromBackup == true, "excluded from backups")
    try cache.close(session: session, clearAll: false)
    try expectFailure { try cache.write(session: session, key: asset, sourceUrl: sourceUrl, base64: png.base64EncodedString()) }
    // A new process/session reuses the binary without requiring any transport.
    date = date.addingTimeInterval(8 * 24 * 60 * 60)
    let reopened = TokenIconDiskCache(directory: directory, now: { date })
    let second = try reopened.open(owner: "session-two")
    let stale = try reopened.read(session: second, key: asset)
    expect(stale?.bytes == png && stale?.savedAtUnixMs == original?.savedAtUnixMs, "offline restart and stale timestamp")
    expect(try reopened.read(session: second, key: key(code: "USD")) == nil, "case-sensitive code")
    expect(try reopened.read(session: second, key: key(code: "Usd", network: "stellar-testnet")) == nil, "network partition")
    expect(try reopened.read(session: second, key: key(code: "Usd", issuer: "G" + String(repeating: "A", count: 55))) == nil, "issuer partition")
    try expectFailure { try reopened.write(session: second, key: "../../escape", sourceUrl: sourceUrl, base64: png.base64EncodedString()) }
    try expectFailure { try reopened.write(session: second, key: asset, sourceUrl: "http://example.org/a", base64: png.base64EncodedString()) }
    try expectFailure { try reopened.write(session: second, key: asset, sourceUrl: sourceUrl, base64: Data(repeating: 1, count: 65_537).base64EncodedString()) }

    // Even a metadata bit flip that is still a valid HTTPS URL is corruption.
    let storedUrl = try files(in: directory)[0]
    var damaged = try Data(contentsOf: storedUrl)
    let sourceRange = damaged.range(of: Data("cdn.example.org".utf8))!
    damaged[sourceRange.lowerBound] = 0x64
    try damaged.write(to: storedUrl)
    expect(try reopened.read(session: second, key: asset) == nil, "metadata corruption is a miss")
    try reopened.write(session: second, key: asset, sourceUrl: sourceUrl, base64: png.base64EncodedString())
    damaged = try Data(contentsOf: storedUrl)
    damaged[damaged.count - 33] ^= 1
    try damaged.write(to: storedUrl)
    // A bit-flipped image is also deleted; a subsequent download can repair it.
    expect(try reopened.read(session: second, key: asset) == nil, "corruption is a miss")
    expect(try files(in: directory).isEmpty, "corruption is removed")
    try reopened.write(session: second, key: asset, sourceUrl: sourceUrl, base64: jpeg.base64EncodedString())
    expect(try reopened.read(session: second, key: asset)?.mimeType == "image/jpeg", "JPEG repair")
    try reopened.remove(session: second, key: asset)
    expect(try reopened.read(session: second, key: asset) == nil, "renderer rejection removal")

    let third = try reopened.open(owner: "another-owner")
    try reopened.write(session: third, key: asset, sourceUrl: sourceUrl, base64: png.base64EncodedString())
    try reopened.close(session: second, clearAll: true)
    // Previously scheduled writers from every owner remain revoked after opt-out.
    for oldSession in [second, third] {
      try expectFailure { try reopened.write(session: oldSession, key: asset, sourceUrl: sourceUrl, base64: png.base64EncodedString()) }
    }
    expect(!FileManager.default.fileExists(atPath: directory.path), "opt-out removes bytes")
    let enabledAgain = try reopened.open(owner: "new-session")
    expect(try reopened.read(session: enabledAgain, key: asset) == nil, "no old bytes after re-enable")
    reopened.closeOwner("new-session")
    try expectFailure { try reopened.write(session: enabledAgain, key: asset, sourceUrl: sourceUrl, base64: png.base64EncodedString()) }
    try reopened.close(session: "", clearAll: true)

    try verifyFailedPurge(root.appendingPathComponent("failed-purge"), bytes: png)
    try verifyFailedEviction(root.appendingPathComponent("failed-eviction"), bytes: png)
    try verifyLRU(root.appendingPathComponent("lru"), bytes: png)
    try verifyLimits(root.appendingPathComponent("count"), bytes: png, byteLimited: false)
    try verifyLimits(root.appendingPathComponent("bytes"), bytes: makeImage(width: 128, height: 128), byteLimited: true)
    print("PASS token icon native cache: PNG/JPEG, bounds, restart, stale timestamp, identity, corruption, LRU, 500 entries / 20 MiB, privacy leases")
  }

  static func verifyFailedPurge(_ directory: URL, bytes: Data) throws {
    let fileManager = PurgeFailingFileManager()
    let cache = TokenIconDiskCache(directory: directory, fileManager: fileManager)
    let session = try cache.open(owner: "purge")
    let asset = key(code: "USD")
    try cache.write(session: session, key: asset, sourceUrl: sourceUrl, base64: bytes.base64EncodedString())
    try expectFailure { try cache.close(session: session, clearAll: true) }
    try expectFailure { _ = try cache.open(owner: "before-repair") }
    try expectFailure { _ = try cache.read(session: session, key: asset) }
    fileManager.failDeletion = false
    let repaired = try cache.open(owner: "after-repair")
    expect(try cache.read(session: repaired, key: asset) == nil, "failed purge retries before re-enable")
  }

  static func verifyFailedEviction(_ directory: URL, bytes: Data) throws {
    let fileManager = PurgeFailingFileManager()
    let cache = TokenIconDiskCache(directory: directory, fileManager: fileManager, entryCountLimit: 1)
    let session = try cache.open(owner: "eviction")
    try cache.write(session: session, key: key(code: "A"), sourceUrl: sourceUrl, base64: bytes.base64EncodedString())
    try expectFailure { try cache.write(session: session, key: key(code: "B"), sourceUrl: sourceUrl, base64: bytes.base64EncodedString()) }
    try expectFailure { try cache.write(session: session, key: key(code: "A"), sourceUrl: sourceUrl, base64: bytes.base64EncodedString()) }
    expect(try files(in: directory).count == 1, "failed eviction cannot exceed capacity")
    expect(try cache.read(session: session, key: key(code: "A"))?.bytes == bytes, "failed cache write preserves prior image")
  }

  static func verifyLRU(_ directory: URL, bytes: Data) throws {
    var date = Date(timeIntervalSince1970: 1_700_000_000)
    let cache = TokenIconDiskCache(directory: directory, now: { date }, entryCountLimit: 2)
    let session = try cache.open(owner: "lru")
    for code in ["A", "B"] {
      try cache.write(session: session, key: key(code: code), sourceUrl: sourceUrl, base64: bytes.base64EncodedString())
      date = date.addingTimeInterval(1)
    }
    let first = try cache.read(session: session, key: key(code: "A"))
    date = date.addingTimeInterval(1)
    try cache.write(session: session, key: key(code: "C"), sourceUrl: sourceUrl, base64: bytes.base64EncodedString())
    expect(try cache.read(session: session, key: key(code: "B")) == nil, "least recently used evicted")
    expect(try cache.read(session: session, key: key(code: "A"))?.savedAtUnixMs == first?.savedAtUnixMs, "read retains original freshness")
    // Cleanup of a partial write is part of reopen, with no index to repair.
    try Data([1, 2]).write(to: directory.appendingPathComponent("interrupted.tmp"))
    _ = try cache.open(owner: "reopen")
    expect(try files(in: directory).count == 2, "partial file cleanup")
  }

  static func verifyLimits(_ directory: URL, bytes: Data, byteLimited: Bool) throws {
    expect(bytes.count <= 65_536, "fixture image limit")
    var date = Date(timeIntervalSince1970: 1_700_000_000)
    let cache = TokenIconDiskCache(directory: directory, now: { date })
    let session = try cache.open(owner: "capacity")
    for index in 0...500 {
      try cache.write(session: session, key: key(code: "A" + String(index)), sourceUrl: sourceUrl, base64: bytes.base64EncodedString())
      date = date.addingTimeInterval(1)
    }
    let stored = try files(in: directory)
    let total = try stored.reduce(0) { result, file in
      result + (try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0)
    }
    expect(stored.count <= 500 && total <= 20 * 1024 * 1024, "production capacity limits")
    expect(byteLimited ? stored.count < 500 : stored.count == 500, "each independent eviction limit")
    expect(try cache.read(session: session, key: key(code: "A0")) == nil, "oldest entry evicted")
    expect(try cache.read(session: session, key: key(code: "A500"))?.bytes == bytes, "newest entry retained")
  }

  static func key(code: String, network: String = "stellar-mainnet", issuer: String = issuer) -> String {
    String(data: try! JSONSerialization.data(withJSONObject: [network, code, issuer]), encoding: .utf8)!
  }

  static func files(in directory: URL) throws -> [URL] {
    try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
  }

  static func expect(_ condition: Bool, _ description: String) {
    precondition(condition, description)
  }

  static func expectFailure(_ operation: () throws -> Void) throws {
    do { try operation() } catch { return }
    preconditionFailure("invalid or retired cache operation succeeded")
  }

  static func makeImage(width: Int, height: Int, format: String = "public.png") -> Data {
    var state: UInt32 = 12_345
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    for index in pixels.indices {
      state = state &* 1_664_525 &+ 1_013_904_223
      pixels[index] = UInt8(state >> 24)
    }
    let provider = CGDataProvider(data: Data(pixels) as CFData)!
    let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
      bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
      provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
    let data = NSMutableData()
    let destination = CGImageDestinationCreateWithData(data, format as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, image, nil)
    precondition(CGImageDestinationFinalize(destination))
    return data as Data
  }
}

private final class PurgeFailingFileManager: FileManager, @unchecked Sendable {
  var failDeletion = true

  override func removeItem(at URL: URL) throws {
    if failDeletion { throw NSError(domain: "fixture-purge-failed", code: 1) }
    try super.removeItem(at: URL)
  }
}
