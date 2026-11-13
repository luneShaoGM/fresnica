package com.fresnica.wallet

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.MediaStore
import android.view.HapticFeedbackConstants
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class PresentationPreferencesModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), ActivityEventListener {
  private var pending: Promise? = null
  private var requestCode = 5200
  init { context.addActivityEventListener(this) }
  override fun getName() = "PresentationPreferences"
  @ReactMethod fun impact() { UiThreadUtil.runOnUiThread { context.currentActivity?.window?.decorView?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK) } }
  @ReactMethod fun pickPalette(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (pending != null || context.currentActivity == null) { promise.reject("image-palette-unavailable", "image-palette-unavailable"); return@runOnUiThread }
      val intent = if (Build.VERSION.SDK_INT >= 33) Intent(MediaStore.ACTION_PICK_IMAGES).apply { type = "image/*" } else Intent(Intent.ACTION_OPEN_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); type = "image/*" }
      requestCode += 1; pending = promise
      try { context.currentActivity!!.startActivityForResult(intent, requestCode) } catch (_: Exception) { pending = null; promise.reject("image-palette-unavailable", "image-palette-unavailable") }
    }
  }
  @ReactMethod fun cancelPalette() { UiThreadUtil.runOnUiThread { val result = pending; pending = null; result?.resolve(null) } }
  override fun onActivityResult(activity: Activity, code: Int, result: Int, data: Intent?) {
    if (code != requestCode) return
    val completion = pending ?: return
    pending = null
    if (result != Activity.RESULT_OK || data?.data == null) { completion.resolve(null); return }
    val uri = data.data!!
    Thread {
      try {
        val bytes = context.contentResolver.openInputStream(uri)?.use { input ->
          val output = ByteArrayOutputStream(); val buffer = ByteArray(8192)
          while (true) { val count = input.read(buffer); if (count < 0) break; if (output.size() + count > 10 * 1024 * 1024) throw IllegalArgumentException(); output.write(buffer, 0, count) }
          output.toByteArray()
        } ?: throw IllegalArgumentException()
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth.toLong() * bounds.outHeight > 100000000) throw IllegalArgumentException()
        var sample = 1; while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 128) sample *= 2
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: throw IllegalArgumentException()
        val small = Bitmap.createScaledBitmap(bitmap, 64, 64, true)
        val histogram = mutableMapOf<Int, Int>()
        for (y in 0 until 64) for (x in 0 until 64) { val pixel = small.getPixel(x,y); if ((pixel ushr 24) > 200) { val color = ((((pixel ushr 16) and 240) + 8) shl 16) or ((((pixel ushr 8) and 240) + 8) shl 8) or ((pixel and 240) + 8); histogram[color] = (histogram[color] ?: 0) + 1 } }
        if (small !== bitmap) small.recycle(); bitmap.recycle()
        if (histogram.isEmpty()) throw IllegalArgumentException()
        val colors = Arguments.createArray(); histogram.entries.sortedByDescending { it.value }.take(16).forEach { colors.pushString(String.format("#%06X", it.key)) }
        completion.resolve(colors)
      } catch (_: Exception) { completion.reject("image-palette-unavailable", "image-palette-unavailable") }
    }.start()
  }
  override fun onNewIntent(intent: Intent) = Unit
  override fun invalidate() { context.removeActivityEventListener(this); pending?.resolve(null); pending = null; super.invalidate() }
}
