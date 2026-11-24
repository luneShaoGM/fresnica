import Foundation
import CryptoKit

// All operations run on SecureAssetFetch's process-wide serial cache queue.
// Public display bytes only: never account data, credentials, or image URLs
// accepted as transaction/identity authority.
final class TokenIconDiskCache {
  static let maximumBytes = 20 * 1024 * 1024
  static let maximumEntries = 500
  private static let imageLimit = 65_536
  private static let headerLimit = 4_096
  private static let entryLimit = 4 + headerLimit + imageLimit + 32

  struct Entry {
    let mimeType: String
    let bytes: Data
    let sourceUrl: String
    let savedAtUnixMs: Int64

    var bridgeValue: [String: Any] {
      ["mimeType": mimeType, "base64": bytes.base64EncodedString(),
       "sourceUrl": sourceUrl, "savedAtUnixMs": savedAtUnixMs]
    }
  }

  private struct Header: Codable {
    let version: Int
    let key: String
    let mimeType: String
    let sourceUrl: String
    let savedAtUnixMs: Int64
  }

  enum Failure: Error { case unavailable }

  private let directory: URL
  private let fileManager: FileManager
  private let now: () -> Date
  private let byteLimit: Int
  private let entryCountLimit: Int
  private var sessions: [String: String] = [:]
  private var pendingClear = false

  init(directory: URL, fileManager: FileManager = .default,
       now: @escaping () -> Date = Date.init,
       byteLimit: Int = TokenIconDiskCache.maximumBytes,
       entryCountLimit: Int = TokenIconDiskCache.maximumEntries) {
    self.directory = directory
    self.fileManager = fileManager
    self.now = now
    self.byteLimit = max(0, byteLimit)
    self.entryCountLimit = max(0, entryCountLimit)
  }

  func open(owner: String) throws -> String {
    // A failed privacy deletion cannot turn into a hit after OFF -> ON.
    // Retry the purge before issuing any new lease; otherwise stay closed.
    if pendingClear { try finishClear() }
    try prepareDirectory()
    try prune()
    let session = UUID().uuidString
    sessions[session] = owner
    return session
  }

  func read(session: String, key: String) throws -> Entry? {
    guard !pendingClear, sessions[session] != nil, let url = entryURL(key) else { throw Failure.unavailable }
    guard fileManager.fileExists(atPath: url.path) else { return nil }
    do {
      let attributes = try fileManager.attributesOfItem(atPath: url.path)
      guard attributes[.type] as? FileAttributeType == .typeRegular,
        let size = attributes[.size] as? NSNumber,
        size.intValue >= 37 && size.intValue <= Self.entryLimit
      else { throw Failure.unavailable }
      let stored = try Data(contentsOf: url)
      guard stored.count >= 37 && stored.count <= Self.entryLimit else { throw Failure.unavailable }
      let payload = Data(stored.dropLast(32))
      guard Data(SHA256.hash(data: payload)) == Data(stored.suffix(32)) else { throw Failure.unavailable }
      let headerLength = payload.prefix(4).reduce(0) { ($0 << 8) | Int($1) }
      guard headerLength > 0 && headerLength <= Self.headerLimit,
        payload.count > 4 + headerLength
      else { throw Failure.unavailable }
      let header = try JSONDecoder().decode(Header.self, from: payload.subdata(in: 4..<(4 + headerLength)))
      let bytes = Data(payload.dropFirst(4 + headerLength))
      guard header.version == 1, header.key == key,
        header.savedAtUnixMs >= 0,
        PublicAssetValidation.safeURL(header.sourceUrl) != nil,
        bytes.count <= Self.imageLimit,
        let mime = PublicAssetValidation.imageMime(bytes), mime == header.mimeType
      else { throw Failure.unavailable }
      // Freshness belongs to the immutable header; LRU access never extends it.
      try? fileManager.setAttributes([.modificationDate: now()], ofItemAtPath: url.path)
      return Entry(mimeType: mime, bytes: bytes, sourceUrl: header.sourceUrl, savedAtUnixMs: header.savedAtUnixMs)
    } catch {
      // Corrupt, truncated or invalid entries are misses, never image inputs.
      try? fileManager.removeItem(at: url)
      return nil
    }
  }

  func write(session: String, key: String, sourceUrl: String, base64: String) throws {
    guard !pendingClear, sessions[session] != nil, let url = entryURL(key),
      PublicAssetValidation.safeURL(sourceUrl) != nil,
      !base64.isEmpty && base64.utf8.count <= 87_384,
      let bytes = Data(base64Encoded: base64), bytes.count <= Self.imageLimit,
      let mimeType = PublicAssetValidation.imageMime(bytes)
    else { throw Failure.unavailable }
    let timestamp = now().timeIntervalSince1970 * 1000
    guard timestamp.isFinite && timestamp >= 0 && timestamp < Double(Int64.max) else { throw Failure.unavailable }
    let header = Header(version: 1, key: key, mimeType: mimeType, sourceUrl: sourceUrl,
                        savedAtUnixMs: Int64(timestamp))
    let encoder = JSONEncoder()
    encoder.outputFormatting = .withoutEscapingSlashes
    let encodedHeader = try encoder.encode(header)
    guard encodedHeader.count <= Self.headerLimit else { throw Failure.unavailable }
    let length = UInt32(encodedHeader.count)
    var stored = Data([UInt8((length >> 24) & 255), UInt8((length >> 16) & 255),
                       UInt8((length >> 8) & 255), UInt8(length & 255)])
    stored.append(encodedHeader)
    stored.append(bytes)
    stored.append(Data(SHA256.hash(data: stored)))
    guard stored.count <= byteLimit && entryCountLimit > 0 else { throw Failure.unavailable }
    try prepareDirectory()
    // Include the atomic temporary file, preserving the previous winner until
    // commit. A failed eviction/write must not leave an oversized cache.
    try prune(reserving: stored.count, replacing: url)
    // One atomic envelope binds source, identity, freshness and exact bytes.
    try stored.write(to: url, options: .atomic)
    try? fileManager.setAttributes([.modificationDate: now()], ofItemAtPath: url.path)
  }

  func remove(session: String, key: String) throws {
    guard sessions[session] != nil, let url = entryURL(key) else { throw Failure.unavailable }
    if fileManager.fileExists(atPath: url.path) { try fileManager.removeItem(at: url) }
  }

  func close(session: String, clearAll: Bool) throws {
    if clearAll {
      // Revoke first: even a failed deletion cannot authorize a late writer.
      sessions.removeAll()
      pendingClear = true
      try finishClear()
    } else {
      sessions.removeValue(forKey: session)
    }
  }

  func closeOwner(_ owner: String) {
    sessions = sessions.filter { $0.value != owner }
  }

  private func finishClear() throws {
    if fileManager.fileExists(atPath: directory.path) { try fileManager.removeItem(at: directory) }
    pendingClear = false
  }

  private func entryURL(_ key: String) -> URL? {
    guard key.utf8.count <= 180,
      let data = key.data(using: .utf8),
      let parts = try? JSONSerialization.jsonObject(with: data) as? [String], parts.count == 3,
      parts[0] == "stellar-mainnet" || parts[0] == "stellar-testnet",
      parts[1].range(of: "^[a-zA-Z0-9]{1,12}$", options: .regularExpression) != nil,
      parts[2].range(of: "^G[A-Z2-7]{55}$", options: .regularExpression) != nil,
      let canonical = try? JSONSerialization.data(withJSONObject: parts), canonical == data
    else { return nil }
    return directory.appendingPathComponent(Self.digest(data) + ".fic", isDirectory: false)
  }

  private func prepareDirectory() throws {
    try fileManager.createDirectory(at: directory, withIntermediateDirectories: true,
                                    attributes: [.posixPermissions: 0o700])
    let existing = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
    guard existing.isDirectory == true && existing.isSymbolicLink != true else { throw Failure.unavailable }
    var resource = directory
    var values = URLResourceValues()
    values.isExcludedFromBackup = true
    try resource.setResourceValues(values)
  }

  private func prune(reserving newBytes: Int = 0, replacing target: URL? = nil) throws {
    let files = try fileManager.contentsOfDirectory(at: directory,
      includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey])
    var entries: [(url: URL, size: Int, accessed: Date)] = []
    for url in files {
      let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey])
      guard url.lastPathComponent.range(of: "^[a-f0-9]{64}\\.fic$", options: .regularExpression) != nil,
        values.isRegularFile == true, values.isSymbolicLink != true,
        let size = values.fileSize, size >= 37 && size <= Self.entryLimit
      else {
        try fileManager.removeItem(at: url)
        continue
      }
      entries.append((url, size, values.contentModificationDate ?? .distantPast))
    }
    entries.sort { $0.accessed == $1.accessed ? $0.url.lastPathComponent < $1.url.lastPathComponent : $0.accessed < $1.accessed }
    var bytes = entries.reduce(0) { $0 + $1.size } + newBytes
    var count = entries.count + (newBytes > 0 ? 1 : 0)
    for entry in entries where entry.url != target {
      if count <= entryCountLimit && bytes <= byteLimit { break }
      try fileManager.removeItem(at: entry.url)
      bytes -= entry.size
      count -= 1
    }
    guard count <= entryCountLimit && bytes <= byteLimit else { throw Failure.unavailable }
  }

  private static func digest(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
}
