import Foundation
import ImageIO
import React
import Network
import Security

@objc(SecureAssetFetch)
final class SecureAssetFetch: NSObject {
  private var active: [String: SecureAssetFetchRequest] = [:]
  private var retired = false

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
    guard !retired, active.count < 2,
      kind == "icon" || kind == "text",
      requestId.range(of: "^[A-Za-z0-9-]{1,48}$", options: .regularExpression) != nil,
      active[requestId] == nil,
      let url = Self.safeURL(rawURL)
    else {
      reject("asset-download-unavailable", "asset-download-unavailable", nil)
      return
    }

    let request = SecureAssetFetchRequest(url: url, kind: kind) { [weak self] result in
      DispatchQueue.main.async { [weak self] in
        guard let self, self.active.removeValue(forKey: requestId) != nil else { return }
        switch result {
        case .success(let payload): resolve(payload)
        case .failure: reject("asset-download-unavailable", "asset-download-unavailable", nil)
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

  @objc func invalidate() {
    retired = true
    Array(active.values).forEach { $0.cancel() }
  }

  private static func safeURL(_ value: String) -> URL? {
    guard value.count >= 12 && value.count <= 2048,
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
    self.limit = kind == "icon" ? 65_536 : 524_288
    self.onFinished = onFinished
  }

  func start() {
    queue.async {
      let timer = DispatchSource.makeTimerSource(queue: self.queue)
      timer.schedule(deadline: .now() + 8)
      timer.setEventHandler { [weak self] in self?.fail() }
      self.deadline = timer
      timer.resume()
      guard let hostname = self.url.host else { self.fail(); return }
      // getaddrinfo may block. Resolve off the request queue so the absolute
      // deadline/cancel path can complete even while DNS is unresponsive.
      DispatchQueue.global(qos: .utility).async { [weak self] in
        let pinned = PublicAssetAddress.resolve(hostname: hostname)
        self?.queue.async { [weak self] in
          guard let self, !self.finished else { return }
          guard let pinned else { self.fail(); return }
          self.connect(to: pinned, certificateHost: hostname)
        }
      }
    }
  }

  func cancel() {
    queue.async { [weak self] in self?.fail() }
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
      case .failed, .cancelled: self.fail()
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
    let accept = kind == "icon" ? "image/png,image/jpeg" : "application/json,text/plain"
    let request = "GET \(path) HTTP/1.1\r\nHost: \(hostname)\r\n" +
      "Accept: \(accept)\r\nAccept-Encoding: identity\r\n" +
      "Connection: close\r\n\r\n"
    guard let payload = request.data(using: .utf8) else { fail(); return }
    connection.send(content: payload, completion: .contentProcessed { [weak self] error in
      self?.queue.async { [weak self] in
        guard let self, !self.finished else { return }
        if error != nil { self.fail() } else { self.receive() }
      }
    })
  }

  private func receive() {
    guard !finished, let connection else { return }
    connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] data, _, isComplete, error in
      self?.queue.async { [weak self] in
        guard let self, !self.finished else { return }
        if error != nil { self.fail(); return }
        if let data, !data.isEmpty {
          // Bound all unparsed bytes as well as the decoded body. Truncated
          // or maliciously framed responses never grow an unbounded buffer.
          if self.pending.count + data.count > self.limit + 16_384 { self.fail(); return }
          self.pending.append(data)
        }
        if !self.hasHeaders {
          guard self.readHeaders() else { self.fail(); return }
          if !self.hasHeaders {
            if isComplete { self.fail() } else { self.receive() }
            return
          }
        }
        guard self.readBody() else { self.fail(); return }
        if self.finished { return }
        if isComplete {
          if case .untilClose = self.framing { self.completeBody() }
          else { self.fail() }
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
      status[1] == "200" else { return false }

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
    let signature: [UInt8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    let png = bytes.count >= 24 && Array(bytes.prefix(8)) == signature
    let jpeg = bytes.count >= 4 && Array(bytes.prefix(3)) == [0xff, 0xd8, 0xff]
    guard png || jpeg,
      let source = CGImageSourceCreateWithData(bytes as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int,
      width >= 1 && width <= 512 && height >= 1 && height <= 512,
      CGImageSourceCreateImageAtIndex(source, 0, [kCGImageSourceShouldCache: false] as CFDictionary) != nil
    else { fail(); return }
    finish(.success([
      "mimeType": png ? "image/png" : "image/jpeg",
      "base64": bytes.base64EncodedString()
    ]))
  }

  private func fail() {
    finish(.failure(NSError(domain: "asset-download-unavailable", code: 1)))
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
