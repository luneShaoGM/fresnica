package com.fresnica.wallet

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState

class SensitiveClipboardModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  private var resumed = context.lifecycleState == LifecycleState.RESUMED
  private var owner: String? = null
  private var marker: String? = null
  private var sequence = 0L
  private val handler = Handler(Looper.getMainLooper())
  private val clipboard get() = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
  init { context.addLifecycleEventListener(this) }
  override fun getName() = "SensitiveClipboard"
  @ReactMethod fun copy(id: String, text: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (!resumed || id.isBlank() || text.isEmpty() || text.toByteArray(Charsets.UTF_8).size > 16384) {
        promise.reject("sensitive-copy-unavailable", "sensitive-copy-unavailable"); return@runOnUiThread
      }
      try {
        val next = "Fresnica recovery $id ${++sequence}"
        val clip = ClipData.newPlainText(next, text)
        clip.description.extras = PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
        clipboard.setPrimaryClip(clip)
        owner = id
        marker = next
        handler.postDelayed({ if (owner == id && marker == next) clearCurrent() }, 30000)
        promise.resolve(null)
      } catch (_: Exception) { promise.reject("sensitive-copy-unavailable", "sensitive-copy-unavailable") }
    }
  }
  @ReactMethod fun clear(id: String) { UiThreadUtil.runOnUiThread { if (owner == id) clearCurrent() } }
  private fun clearCurrent() {
    try {
      if (marker != null && clipboard.primaryClipDescription?.label?.toString() == marker) {
        if (Build.VERSION.SDK_INT >= 28) clipboard.clearPrimaryClip() else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
      }
    } catch (_: Exception) {
      // An OS clipboard denial cannot crash lifecycle cleanup. The timed cleanup remains best effort.
    } finally { owner = null; marker = null }
  }
  override fun onHostResume() { resumed = true }
  override fun onHostPause() { resumed = false; clearCurrent() }
  override fun onHostDestroy() { resumed = false; clearCurrent() }
  override fun invalidate() {
    UiThreadUtil.runOnUiThread { resumed = false; clearCurrent(); handler.removeCallbacksAndMessages(null) }
    context.removeLifecycleEventListener(this)
    super.invalidate()
  }
}
