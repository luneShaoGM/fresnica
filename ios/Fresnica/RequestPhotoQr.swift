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
