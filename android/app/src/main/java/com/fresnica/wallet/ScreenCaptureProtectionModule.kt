package com.fresnica.wallet

import android.view.WindowManager
import com.facebook.react.bridge.*

class ScreenCaptureProtectionModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  @Volatile private var resumed = context.lifecycleState == com.facebook.react.common.LifecycleState.RESUMED
  init { context.addLifecycleEventListener(this) }
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
  override fun onHostResume() { resumed = true; protect() }
  override fun onHostPause() { resumed = false; protect() }
  override fun onHostDestroy() { resumed = false; protect() }
  override fun invalidate() { resumed = false; UiThreadUtil.runOnUiThread { protect() }; context.removeLifecycleEventListener(this); super.invalidate() }
}
