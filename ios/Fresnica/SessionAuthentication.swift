import LocalAuthentication
import React
import UIKit

// App access only. This module never receives a signer, envelope or wallet key.
@objc(SessionAuthentication)
final class SessionAuthentication: NSObject {
  private var context: LAContext?
  private var requestId: String?
  private var resolver: RCTPromiseResolveBlock?
  private var observer: NSObjectProtocol?

  override init() {
    super.init()
    observer = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
      self?.cancelCurrent()
    }
  }
  deinit {
    if let observer { NotificationCenter.default.removeObserver(observer) }
    context?.invalidate()
  }
  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc(canAuthenticate:rejecter:)
  func canAuthenticate(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let next = LAContext()
    resolve(next.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil))
    next.invalidate()
  }
  @objc(authenticate:reason:cancelLabel:resolver:rejecter:)
  func authenticate(_ id: String, reason: String, cancelLabel: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.context == nil, UIApplication.shared.applicationState == .active, !id.isEmpty, !reason.isEmpty else {
        reject("session-auth-unavailable", "session-auth-unavailable", nil)
        return
      }
      let next = LAContext()
      next.localizedFallbackTitle = ""
      next.localizedCancelTitle = cancelLabel
      next.touchIDAuthenticationAllowableReuseDuration = 0
      guard next.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
        next.invalidate()
        resolve(false)
        return
      }
      self.context = next
      self.requestId = id
      self.resolver = resolve
      next.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { [weak self] success, _ in
        DispatchQueue.main.async {
          guard let self, self.requestId == id else { return }
          self.finish(success && UIApplication.shared.applicationState != .background)
        }
      }
    }
  }
  @objc(cancel:)
  func cancel(_ id: String) {
    DispatchQueue.main.async { if self.requestId == id { self.cancelCurrent() } }
  }
  private func finish(_ success: Bool) {
    let completion = resolver
    let current = context
    context = nil
    requestId = nil
    resolver = nil
    current?.invalidate()
    completion?(success)
  }
  private func cancelCurrent() { finish(false) }
}

// Separate from App authentication: deliberate, device-local recovery export only.
@objc(SensitiveClipboard)
final class SensitiveClipboard: NSObject {
  private var owner: String?
  private var changeCount: Int?
  private var observer: NSObjectProtocol?
  override init() {
    super.init()
    observer = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.clearCurrent() }
  }
  deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }
  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc(copy:text:resolver:rejecter:)
  func copy(_ id: String, text: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard UIApplication.shared.applicationState == .active, !id.isEmpty, !text.isEmpty, text.utf8.count <= 16384 else {
        reject("sensitive-copy-unavailable", "sensitive-copy-unavailable", nil); return
      }
      UIPasteboard.general.setItems([[UIPasteboard.typeAutomatic: text]], options: [.localOnly: true, .expirationDate: Date().addingTimeInterval(30)])
      self.owner = id
      self.changeCount = UIPasteboard.general.changeCount
      let writtenCount = self.changeCount
      DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
        if self?.owner == id && self?.changeCount == writtenCount { self?.clearCurrent() }
      }
      resolve(nil)
    }
  }
  @objc(clear:)
  func clear(_ id: String) { DispatchQueue.main.async { if self.owner == id { self.clearCurrent() } } }
  private func clearCurrent() {
    if let changeCount, UIPasteboard.general.changeCount == changeCount { UIPasteboard.general.items = [] }
    owner = nil
    changeCount = nil
  }
}
