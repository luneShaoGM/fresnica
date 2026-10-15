package com.fresnica.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

class RequestPhotoQrModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {
  private var pending: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun pickQr(promise: Promise) {
    if (pending != null) {
      promise.reject(FAILURE, FAILURE, null)
      return
    }
    val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          Intent(MediaStore.ACTION_PICK_IMAGES).apply {
            type = "image/*"
            putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, 1)
          }
        } else {
          Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
          }
        }
    pending = promise
    val started =
        try {
          reactApplicationContext.startActivityForResult(intent, REQUEST_CODE, null)
        } catch (_: Exception) {
          false
        }
    if (!started) {
      pending = null
      promise.reject(FAILURE, FAILURE, null)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE || pending == null) return
    if (resultCode != Activity.RESULT_OK || data == null) {
      resolve(status = "cancelled")
      return
    }
    val uri = data.data
    if (uri == null) {
      resolve(status = "empty")
      return
    }
    readQr(uri)
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun readQr(uri: Uri) {
    val image =
        try {
          InputImage.fromFilePath(reactApplicationContext, uri)
        } catch (_: Exception) {
          reject()
          return
        }
    val options = BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build()
    BarcodeScanning.getClient(options)
        .process(image)
        .addOnSuccessListener { barcodes ->
          val value = barcodes.firstOrNull()?.rawValue
          if (value.isNullOrEmpty()) resolve(status = "empty") else resolve(status = "found", value = value)
        }
        .addOnFailureListener { reject() }
  }

  private fun resolve(status: String, value: String? = null) {
    val promise = pending ?: return
    pending = null
    val payload: WritableMap = Arguments.createMap()
    payload.putString("status", status)
    if (value != null) payload.putString("value", value)
    promise.resolve(payload)
  }

  private fun reject() {
    val promise = pending ?: return
    pending = null
    promise.reject(FAILURE, FAILURE, null)
  }

  private companion object {
    const val NAME = "RequestPhotoQr"
    const val REQUEST_CODE = 41009
    const val FAILURE = "request-photo-qr-failed"
  }
}
