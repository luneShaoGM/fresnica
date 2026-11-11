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
