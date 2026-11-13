import ImageIO
import PhotosUI
import React
import UIKit
import Vision

@objc(RequestPhotoQr)
final class RequestPhotoQr: NSObject, PHPickerViewControllerDelegate {
  private var resolver: RCTPromiseResolveBlock?
  private var rejecter: RCTPromiseRejectBlock?

  @objc static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(pickQr:rejecter:)
  func pickQr(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if self.resolver != nil {
        reject("request-photo-qr-failed", "request-photo-qr-failed", nil)
        return
      }
      guard let presenter = Self.topViewController() else {
        reject("request-photo-qr-failed", "request-photo-qr-failed", nil)
        return
      }
      self.resolver = resolve
      self.rejecter = reject
      var configuration = PHPickerConfiguration()
      configuration.filter = .images
      configuration.selectionLimit = 1
      let picker = PHPickerViewController(configuration: configuration)
      picker.delegate = self
      presenter.present(picker, animated: true)
    }
  }

  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let provider = results.first?.itemProvider else {
      finish(["status": "cancelled"])
      return
    }
    guard provider.canLoadObject(ofClass: UIImage.self) else {
      finish(["status": "empty"])
      return
    }
    provider.loadObject(ofClass: UIImage.self) { [weak self] object, error in
      // PHPicker invokes this callback off the main queue. UIImage drawing must stay on main.
      DispatchQueue.main.async {
        guard let self else { return }
        if error != nil {
          self.fail()
          return
        }
        guard let image = object as? UIImage, let cgImage = Self.cgImageForScanning(image) else {
          self.finish(["status": "empty"])
          return
        }
        let request = VNDetectBarcodesRequest()
        request.symbologies = [.qr]
        do {
          try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
          let value = request.results?.compactMap(\.payloadStringValue).first { !$0.isEmpty }
          if let value {
            self.finish(["status": "found", "value": value])
          } else {
            self.finish(["status": "empty"])
          }
        } catch {
          self.fail()
        }
      }
    }
  }

  private func finish(_ payload: [String: String]) {
    DispatchQueue.main.async {
      self.resolver?(payload)
      self.resolver = nil
      self.rejecter = nil
    }
  }

  private func fail() {
    DispatchQueue.main.async {
      self.rejecter?("request-photo-qr-failed", "request-photo-qr-failed", nil)
      self.resolver = nil
      self.rejecter = nil
    }
  }

  private static func topViewController() -> UIViewController? {
    guard var controller = UIApplication.shared.delegate?.window??.rootViewController else {
      return nil
    }
    while let presented = controller.presentedViewController {
      controller = presented
    }
    return controller
  }

  private static func cgImageForScanning(_ image: UIImage) -> CGImage? {
    let maxSide: CGFloat = 2048
    let longest = max(image.size.width, image.size.height)
    let scale = longest > maxSide && longest > 0 ? maxSide / longest : 1
    let target = CGSize(width: image.size.width * scale, height: image.size.height * scale)
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let rendered = UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: target))
    }
    return rendered.cgImage
  }
}

// Settings-only, local image sampling. Neither image bytes nor paths cross the bridge.
@objc(PresentationPreferences)
final class PresentationPreferences: NSObject, PHPickerViewControllerDelegate {
  private var resolver: RCTPromiseResolveBlock?
  private var rejecter: RCTPromiseRejectBlock?
  private var picker: PHPickerViewController?
  @objc static func requiresMainQueueSetup() -> Bool { true }
  @objc(impact) func impact() { DispatchQueue.main.async { UIImpactFeedbackGenerator(style: .light).impactOccurred() } }
  @objc(pickPalette:rejecter:)
  func pickPalette(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.resolver == nil, UIApplication.shared.applicationState == .active,
        var presenter = UIApplication.shared.delegate?.window??.rootViewController else {
        reject("image-palette-unavailable", "image-palette-unavailable", nil); return
      }
      while let next = presenter.presentedViewController { presenter = next }
      self.resolver = resolve; self.rejecter = reject
      var configuration = PHPickerConfiguration(); configuration.filter = .images; configuration.selectionLimit = 1
      let picker = PHPickerViewController(configuration: configuration); self.picker = picker; picker.delegate = self
      presenter.present(picker, animated: true)
    }
  }
  @objc(cancelPalette) func cancelPalette() {
    DispatchQueue.main.async { self.picker?.dismiss(animated: false); self.finish(nil) }
  }
  func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
    picker.dismiss(animated: true)
    guard let provider = results.first?.itemProvider else { finish(nil); return }
    provider.loadFileRepresentation(forTypeIdentifier: "public.image") { [weak self, weak picker] url, _ in
      guard let url, let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 10 * 1024 * 1024,
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 64] as CFDictionary) else {
        DispatchQueue.main.async { if self?.picker === picker { self?.fail() } }; return
      }
      var bytes = [UInt8](repeating: 0, count: 64 * 64 * 4)
      var colors: [Int: Int] = [:]
      bytes.withUnsafeMutableBytes { buffer in
        if let context = CGContext(data: buffer.baseAddress, width: 64, height: 64, bitsPerComponent: 8, bytesPerRow: 256, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) {
          context.draw(image, in: CGRect(x: 0, y: 0, width: 64, height: 64))
        }
      }
      for index in stride(from: 0, to: bytes.count, by: 4) where bytes[index + 3] > 200 {
        let color = ((Int(bytes[index]) & 240) + 8) << 16 | ((Int(bytes[index+1]) & 240) + 8) << 8 | ((Int(bytes[index+2]) & 240) + 8)
        colors[color, default: 0] += 1
      }
      let samples = colors.sorted { $0.value > $1.value }.prefix(16).map { String(format: "#%06X", $0.key) }
      DispatchQueue.main.async { if self?.picker === picker { if samples.isEmpty { self?.fail() } else { self?.finish(samples) } } }
    }
  }
  private func finish(_ value: [String]?) { resolver?(value); resolver = nil; rejecter = nil; picker = nil }
  private func fail() { rejecter?("image-palette-unavailable", "image-palette-unavailable", nil); resolver = nil; rejecter = nil; picker = nil }
}
