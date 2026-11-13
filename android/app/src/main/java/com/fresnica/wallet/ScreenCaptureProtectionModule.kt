package com.fresnica.wallet

import android.view.Window
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.interfaces.ExtraWindowEventListener

class ScreenCaptureProtectionModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener, ExtraWindowEventListener {
  @Volatile private var resumed = context.lifecycleState == com.facebook.react.common.LifecycleState.RESUMED
  init {
    context.addLifecycleEventListener(this)
    context.addExtraWindowEventListener(this)
  }
  override fun getName() = "ScreenCaptureProtection"
  @ReactMethod fun setProtected(required: Boolean, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val window = context.currentActivity?.window
      if (window == null) { promise.resolve(false); return@runOnUiThread }
      if (required || !resumed) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      promise.resolve(required || resumed)
    }
  }
  private fun protect() { context.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_SECURE) }
  // Dialogs have independent windows; keep them protected even during the Activity's capture opt-out.
  override fun onExtraWindowCreate(window: Window) { window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) }
  override fun onExtraWindowDestroy(window: Window) = Unit
  override fun onHostResume() { resumed = true; protect() }
  override fun onHostPause() { resumed = false; protect() }
  override fun onHostDestroy() { resumed = false; protect() }
  override fun invalidate() {
    resumed = false
    UiThreadUtil.runOnUiThread {
      protect()
      context.removeExtraWindowEventListener(this)
    }
    context.removeLifecycleEventListener(this)
    super.invalidate()
  }
}
