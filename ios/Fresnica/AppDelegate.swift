import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "Fresnica",
      in: window,
      launchOptions: launchOptions
    )

    PrivacyShield.cover()
    return true
  }

  func applicationWillResignActive(_ application: UIApplication) {
    PrivacyShield.cover()
  }

  // The registered web+stellar scheme must reach Linking's warm-url listener.
  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return RCTLinkingManager.application(app, open: url, options: options)
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

@objc(PrivacyShield)
class PrivacyShield: NSObject {
  private static var shield: UIWindow?
  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc var methodQueue: DispatchQueue { DispatchQueue.main }

  static func cover() {
    if shield == nil {
      let cover = UIWindow(frame: UIScreen.main.bounds)
      cover.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
      let controller = UIViewController()
      controller.view.backgroundColor = UIColor.systemBackground
      cover.rootViewController = controller
      shield = cover
    }
    shield?.isHidden = false
  }

  @objc func reveal(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    guard UIApplication.shared.applicationState == .active else {
      reject("privacy-not-active", "Application is not active", nil)
      return
    }
    PrivacyShield.shield?.isHidden = true
    resolve(nil)
  }
}
