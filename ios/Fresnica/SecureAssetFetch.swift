import Foundation
import ImageIO
import React

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

private final class SecureAssetFetchRequest: NSObject, URLSessionDataDelegate, URLSessionTaskDelegate {
  private let kind: String
  private let limit: Int
  private let onFinished: (Result<[String: String], Error>) -> Void
  private var bytes = Data()
  private let lock = NSLock()
  private var finished = false

  private lazy var session: URLSession = {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.httpShouldSetCookies = false
    configuration.httpCookieAcceptPolicy = .never
    configuration.timeoutIntervalForRequest = 6
    configuration.timeoutIntervalForResource = 8
    configuration.httpMaximumConnectionsPerHost = 2
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
  }()
  private var task: URLSessionDataTask?
  private let url: URL

  init(url: URL, kind: String, onFinished: @escaping (Result<[String: String], Error>) -> Void) {
    self.url = url
    self.kind = kind
    self.limit = kind == "icon" ? 65_536 : 524_288
    self.onFinished = onFinished
    super.init()
  }

  func start() {
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.setValue(kind == "icon" ? "image/png,image/jpeg" : "application/json,text/plain", forHTTPHeaderField: "Accept")
    task = session.dataTask(with: request)
    task?.resume()
  }

  func cancel() {
    finish(.failure(NSError(domain: "asset-download-unavailable", code: 1)))
  }

  // Explicitly refuse the redirect before URLSession can issue a second request.
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) {
    completionHandler(nil)
    cancel()
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    guard let http = response as? HTTPURLResponse,
      http.statusCode == 200,
      response.expectedContentLength <= Int64(limit)
    else {
      completionHandler(.cancel)
      cancel()
      return
    }
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard bytes.count + data.count <= limit else {
      cancel()
      return
    }
    bytes.append(data)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if let error {
      finish(.failure(error))
      return
    }
    if kind == "text" {
      guard let value = String(data: bytes, encoding: .utf8) else { cancel(); return }
      finish(.success(["text": value]))
      return
    }

    let pngSignature: [UInt8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    let isPNG = bytes.count >= 24 && Array(bytes.prefix(8)) == pngSignature
    let isJPEG = bytes.count >= 4 && Array(bytes.prefix(3)) == [0xff, 0xd8, 0xff]
    guard isPNG || isJPEG,
      let imageSource = CGImageSourceCreateWithData(bytes as CFData, [kCGImageSourceShouldCache: false] as CFDictionary),
      let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
      let width = properties[kCGImagePropertyPixelWidth] as? Int,
      let height = properties[kCGImagePropertyPixelHeight] as? Int,
      width >= 1 && width <= 512 && height >= 1 && height <= 512,
      CGImageSourceCreateImageAtIndex(imageSource, 0, [kCGImageSourceShouldCache: false] as CFDictionary) != nil
    else { cancel(); return }
    finish(.success([
      "mimeType": isPNG ? "image/png" : "image/jpeg",
      "base64": bytes.base64EncodedString()
    ]))
  }

  private func finish(_ result: Result<[String: String], Error>) {
    lock.lock()
    let first = !finished
    if first { finished = true }
    lock.unlock()
    guard first else { return }
    task?.cancel()
    session.invalidateAndCancel()
    onFinished(result)
  }
}
