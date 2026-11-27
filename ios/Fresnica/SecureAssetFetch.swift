import Foundation
import React
import Network
import Security

@objc(SecureAssetFetch)
final class SecureAssetFetch: NSObject {
  private var active: [String: SecureAssetFetchRequest] = [:]
  private var retired = false
  private let cacheOwner = UUID().uuidString
  private static let cacheQueue = DispatchQueue(label: "fresnica.token-icon-cache", qos: .utility)
  private static let iconCache: TokenIconDiskCache? = FileManager.default
    .urls(for: .cachesDirectory, in: .userDomainMask).first.map {
      TokenIconDiskCache(directory: $0.appendingPathComponent("public-token-icons-v1", isDirectory: true))
    }

  private static let avatarCache: TokenIconDiskCache? = FileManager.default
    .urls(for: .cachesDirectory, in: .userDomainMask).first.map {
      TokenIconDiskCache(directory: $0.appendingPathComponent("public-account-avatars-v1", isDirectory: true), avatar: true)
    }

  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc var methodQueue: DispatchQueue { .main }

  @objc(fetch:kind:requestId:resolver:rejecter:)
  func fetch(
    _ rawURL: String,
    kind: String,
    requestId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard !retired,
      kind == "icon" || kind == "avatar" || kind == "text",
      requestId.range(of: "^[A-Za-z0-9-]{1,48}$", options: .regularExpression) != nil,
      active[requestId] == nil,
      let url = PublicAssetValidation.safeURL(rawURL)
    else {
      reject("asset-download-blocked", "asset-download-blocked", nil)
      return
    }
    guard active.count < 2 else {
      reject("asset-download-transient", "asset-download-transient", nil)
      return
    }

    let request = SecureAssetFetchRequest(url: url, kind: kind) { [weak self] result in
      DispatchQueue.main.async { [weak self] in
        guard let self, self.active.removeValue(forKey: requestId) != nil else { return }
        switch result {
        case .success(let payload): resolve(payload)
        case .failure(let error):
          let code = (error as? PublicAssetFetchFailure)?.rawValue ?? "asset-download-unavailable"
          reject(code, code, nil)
        }
      }
    }
    active[requestId] = request
    request.start()
  }

  @objc(cancel:)
  func cancel(_ requestId: String) {
    active[requestId]?.cancel()
  }

  @objc(openIconCache:resolver:rejecter:)
  func openIconCache(_ epoch: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    let owner = cacheOwner
    performCache(resolve, reject) { try $0.open(owner: owner, epoch: epoch) }
  }

  @objc(readIconCache:key:resolver:rejecter:)
  func readIconCache(_ session: String, key: String,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject) { try $0.read(session: session, key: key)?.bridgeValue }
  }

  @objc(writeIconCache:key:sourceUrl:base64:resolver:rejecter:)
  func writeIconCache(_ session: String, key: String, sourceUrl: String, base64: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject) {
      try $0.write(session: session, key: key, sourceUrl: sourceUrl, base64: base64)
      return nil
    }
  }

  @objc(removeIconCache:key:resolver:rejecter:)
  func removeIconCache(_ session: String, key: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject) {
      try $0.remove(session: session, key: key)
      return nil
    }
  }

  @objc(closeIconCache:clearAll:resolver:rejecter:)
  func closeIconCache(_ session: String, clearAll: Bool,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject) {
      try $0.close(session: session, clearAll: clearAll)
      return nil
    }
  }

  @objc(openAvatarCache:resolver:rejecter:)
  func openAvatarCache(_ epoch: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    let owner = cacheOwner
    performCache(resolve, reject, cache: Self.avatarCache) { try $0.open(owner: owner, epoch: epoch) }
  }

  @objc(readAvatarCache:key:resolver:rejecter:)
  func readAvatarCache(_ session: String, key: String,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject, cache: Self.avatarCache) { try $0.read(session: session, key: key)?.bridgeValue }
  }

  @objc(writeAvatarCache:key:sourceUrl:base64:resolver:rejecter:)
  func writeAvatarCache(_ session: String, key: String, sourceUrl: String, base64: String,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject, cache: Self.avatarCache) {
      try $0.write(session: session, key: key, sourceUrl: sourceUrl, base64: base64)
      return nil
    }
  }

  @objc(removeAvatarCache:key:resolver:rejecter:)
  func removeAvatarCache(_ session: String, key: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject, cache: Self.avatarCache) {
      try $0.remove(session: session, key: key)
      return nil
    }
  }

  @objc(closeAvatarCache:clearAll:resolver:rejecter:)
  func closeAvatarCache(_ session: String, clearAll: Bool,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    performCache(resolve, reject, cache: Self.avatarCache) {
      try $0.close(session: session, clearAll: clearAll)
      return nil
    }
  }

  private func performCache(_ resolve: @escaping RCTPromiseResolveBlock,
                            _ reject: @escaping RCTPromiseRejectBlock,
                            cache: TokenIconDiskCache? = SecureAssetFetch.iconCache,
                            _ operation: @escaping (TokenIconDiskCache) throws -> Any?) {
    guard !retired else { reject("asset-cache-unavailable", "asset-cache-unavailable", nil); return }
    Self.cacheQueue.async {
      do {
        guard let cache else { throw TokenIconDiskCache.Failure.unavailable }
        resolve(try operation(cache))
      } catch {
        reject("asset-cache-unavailable", "asset-cache-unavailable", nil)
      }
    }
  }

  @objc func invalidate() {
    retired = true
    Array(active.values).forEach { $0.cancel() }
    let owner = cacheOwner
    Self.cacheQueue.async {
      Self.iconCache?.closeOwner(owner)
      Self.avatarCache?.closeOwner(owner)
    }
  }
}

private enum PublicAssetFetchFailure: String, Error {
  case transient = "asset-download-transient"
  case blocked = "asset-download-blocked"
  case invalid = "asset-download-invalid"
  case cancelled = "asset-download-cancelled"
  case unavailable = "asset-download-unavailable"
}

private final class SecureAssetFetchRequest {
  private enum BodyFraming {
    case length(Int)
    case chunked
    case untilClose
  }

  private let url: URL
  private let kind: String
  private let limit: Int
  private let onFinished: (Result<[String: String], Error>) -> Void
  private let queue = DispatchQueue(label: "fresnica.secure-asset-fetch")
  private var connection: NWConnection?
  private var deadline: DispatchSourceTimer?
  private var finished = false
  private var hasHeaders = false
  private var framing: BodyFraming = .untilClose
  private var pending = Data()
  private var bytes = Data()
  private var chunkSize: Int?

  init(url: URL, kind: String, onFinished: @escaping (Result<[String: String], Error>) -> Void) {
    self.url = url
    self.kind = kind
    self.limit = kind == "icon" ? 65_536 : kind == "avatar" ? 262_144 : 524_288
    self.onFinished = onFinished
  }

  func start() {
    queue.async {
      let timer = DispatchSource.makeTimerSource(queue: self.queue)
      timer.schedule(deadline: .now() + 8)
      timer.setEventHandler { [weak self] in self?.fail(.transient) }
      self.deadline = timer
      timer.resume()
      guard let hostname = self.url.host else { self.fail(); return }
      // getaddrinfo may block. Resolve off the request queue so the absolute
      // deadline/cancel path can complete even while DNS is unresponsive.
      DispatchQueue.global(qos: .utility).async { [weak self] in
        let resolution = PublicAssetAddress.resolve(hostname: hostname)
        self?.queue.async { [weak self] in
          guard let self, !self.finished else { return }
          switch resolution {
          case .pinned(let host): self.connect(to: host, certificateHost: hostname)
          case .unavailable: self.fail(.unavailable)
          case .blocked: self.fail(.blocked)
          }
        }
      }
    }
  }

  func cancel() {
    queue.async { [weak self] in self?.fail(.cancelled) }
  }

  private func connect(to address: NWEndpoint.Host, certificateHost hostname: String) {
    let tls = NWProtocolTLS.Options()
    let options = tls.securityProtocolOptions
    sec_protocol_options_set_min_tls_protocol_version(options, .TLSv12)
    hostname.withCString { sec_protocol_options_set_tls_server_name(options, $0) }
    sec_protocol_options_add_tls_application_protocol(options, "http/1.1")
    // Numeric endpoint pinning must not turn into "accept any certificate".
    // Authenticate the original DNS name with the normal system trust roots.
    sec_protocol_options_set_verify_block(options, { _, peerTrust, complete in
      let trust = sec_trust_copy_ref(peerTrust).takeRetainedValue()
      let hostnamePolicy = SecPolicyCreateSSL(true, hostname as CFString)
      guard SecTrustSetPolicies(trust, hostnamePolicy) == errSecSuccess else {
        complete(false)
        return
      }
      complete(SecTrustEvaluateWithError(trust, nil))
    }, queue)
    let parameters = NWParameters(tls: tls, tcp: NWProtocolTCP.Options())
    let connection = NWConnection(host: address, port: .https, using: parameters)
    self.connection = connection
    connection.stateUpdateHandler = { [weak self] state in
      guard let self, !self.finished else { return }
      switch state {
      case .ready: self.sendRequest()
      case .failed(let error):
        if case .tls = error { self.fail(.blocked) } else { self.fail(.transient) }
      case .cancelled: self.fail(.cancelled)
      default: break
      }
    }
    // The endpoint contains numeric IPv4/IPv6 bytes from a validated DNS
    // result; Network.framework never gets the original hostname to rebind.
    connection.start(queue: queue)
  }

  private func sendRequest() {
    guard let connection, let hostname = url.host,
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
    else { fail(); return }
    let path = (components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath) +
      (components.percentEncodedQuery.map { "?" + $0 } ?? "")
    let accept = kind != "text" ? "image/png,image/jpeg" : "application/json,text/plain"
    let request = "GET \(path) HTTP/1.1\r\nHost: \(hostname)\r\n" +
      "Accept: \(accept)\r\nAccept-Encoding: identity\r\n" +
      "Connection: close\r\n\r\n"
    guard let payload = request.data(using: .utf8) else { fail(); return }
    connection.send(content: payload, completion: .contentProcessed { [weak self] error in
      self?.queue.async { [weak self] in
        guard let self, !self.finished else { return }
        if error != nil { self.fail(.transient) } else { self.receive() }
      }
    })
  }

  private func receive() {
    guard !finished, let connection else { return }
    connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
      self?.queue.async { [weak self] in
        guard let self, !self.finished else { return }
        if error != nil { self.fail(.transient); return }
        if let data, !data.isEmpty {
          // Bound all unparsed bytes as well as the decoded body. Truncated
          // or maliciously framed responses never grow an unbounded buffer.
          if self.pending.count + data.count > self.limit + 16_384 { self.fail(); return }
          self.pending.append(data)
        }
        if !self.hasHeaders {
          guard self.readHeaders() else { self.fail(); return }
          if !self.hasHeaders {
            if isComplete { self.fail(.transient) } else { self.receive() }
            return
          }
        }
        guard self.readBody() else { self.fail(); return }
        if self.finished { return }
        if isComplete {
          if case .untilClose = self.framing { self.completeBody() }
          else { self.fail(.transient) }
        } else {
          self.receive()
        }
      }
    }
  }

  // Parse at most 16 KiB of HTTP/1.x headers. Reject all non-200 responses
  // (including redirects) without initiating any follow-up connection.
  private func readHeaders() -> Bool {
    let delimiter = Data([13, 10, 13, 10])
    guard let range = pending.range(of: delimiter) else {
      return pending.count <= 16_384
    }
    guard range.lowerBound <= 16_384,
      let headerText = String(data: pending.prefix(upTo: range.lowerBound), encoding: .utf8)
    else { return false }
    pending = Data(pending.suffix(from: range.upperBound))
    var lines = headerText.components(separatedBy: "\r\n")
    guard !lines.isEmpty else { return false }
    let status = lines.removeFirst().split(separator: " ")
    guard status.count >= 2,
      (status[0] == "HTTP/1.1" || status[0] == "HTTP/1.0"),
      status[1].utf8.count == 3, status[1].utf8.allSatisfy({ (48...57).contains($0) }),
      let statusCode = Int(status[1]) else { return false }
    if statusCode == 429 || (500...599).contains(statusCode) {
      fail(.transient)
      return false
    }
    guard statusCode == 200 else { return false }

    var headers: [String: String] = [:]
    for line in lines {
      guard let colon = line.firstIndex(of: ":"), colon != line.startIndex else { return false }
      let name = line[..<colon].lowercased()
      let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      guard !headers.keys.contains(name) else { return false }
      headers[name] = value
    }
    if let encoding = headers["content-encoding"], encoding.lowercased() != "identity" { return false }
    if let encoding = headers["transfer-encoding"] {
      guard encoding.lowercased() == "chunked", headers["content-length"] == nil else { return false }
      framing = .chunked
    } else if let length = headers["content-length"] {
      guard !length.isEmpty,
        length.utf8.allSatisfy({ (48...57).contains($0) }),
        let size = Int(length), size <= limit
      else { return false }
      framing = .length(size)
    }
    hasHeaders = true
    return true
  }

  private func readBody() -> Bool {
    switch framing {
    case .length(let declared):
      guard pending.count <= declared - bytes.count, bytes.count + pending.count <= limit else { return false }
      bytes.append(pending)
      pending.removeAll()
      if bytes.count == declared { completeBody() }
      return true
    case .untilClose:
      guard bytes.count + pending.count <= limit else { return false }
      bytes.append(pending)
      pending.removeAll()
      return true
    case .chunked:
      let crlf = Data([13, 10])
      while !finished {
        if chunkSize == nil {
          guard let lineEnd = pending.range(of: crlf) else { return pending.count <= 80 }
          guard lineEnd.lowerBound <= 80,
            let chunkLine = String(data: pending.prefix(upTo: lineEnd.lowerBound), encoding: .ascii)
          else { return false }
          let sizeText = chunkLine.components(separatedBy: ";")[0]
          guard !sizeText.isEmpty,
            sizeText.utf8.allSatisfy({ (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0) }),
            let size = Int(sizeText, radix: 16),
            size <= limit - bytes.count
          else { return false }
          pending = Data(pending.suffix(from: lineEnd.upperBound))
          chunkSize = size
        }
        guard let size = chunkSize else { return false }
        if size == 0 {
          if pending.count < 2 { return true }
          guard pending.prefix(2) == crlf, pending.count == 2 else { return false }
          pending.removeAll()
          completeBody()
          return true
        }
        if pending.count < size + 2 { return true }
        guard Data(pending.dropFirst(size).prefix(2)) == crlf else { return false }
        bytes.append(pending.prefix(size))
        pending = Data(pending.dropFirst(size + 2))
        chunkSize = nil
      }
      return true
    }
  }

  private func completeBody() {
    if kind == "text" {
      guard let text = String(data: bytes, encoding: .utf8) else { fail(); return }
      finish(.success(["text": text]))
      return
    }
    guard let mimeType = PublicAssetValidation.imageMime(bytes) else { fail(); return }
    finish(.success([
      "mimeType": mimeType,
      "base64": bytes.base64EncodedString()
    ]))
  }

  private func fail(_ error: PublicAssetFetchFailure = .invalid) {
    finish(.failure(error))
  }

  private func finish(_ result: Result<[String: String], Error>) {
    guard !finished else { return }
    finished = true
    deadline?.cancel()
    deadline = nil
    connection?.cancel()
    connection = nil
    onFinished(result)
  }
}
