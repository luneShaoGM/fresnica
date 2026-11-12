package com.fresnica.wallet

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState
import java.util.concurrent.Executor

// OS identity check for App access only. No wallet key or SDK operation is involved.
class SessionAuthenticationModule(
  private val context: ReactApplicationContext,
  private val callbackExecutor: Executor = ContextCompat.getMainExecutor(context),
) : ReactContextBaseJavaModule(context), LifecycleEventListener {
  private var resumed = context.lifecycleState == LifecycleState.RESUMED
  private var requestId: String? = null
  private var pending: Promise? = null
  private var prompt: BiometricPrompt? = null
  init { context.addLifecycleEventListener(this) }
  override fun getName() = "SessionAuthentication"

  @ReactMethod fun canAuthenticate(promise: Promise) {
    promise.resolve(BiometricManager.from(context).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS)
  }

  @ReactMethod fun authenticate(id: String, reason: String, cancelLabel: String, promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val activity = context.currentActivity as? FragmentActivity
      if (!resumed || activity == null || requestId != null || id.isBlank() || reason.isBlank() || cancelLabel.isBlank()) {
        promise.reject("session-auth-unavailable", "session-auth-unavailable")
        return@runOnUiThread
      }
      requestId = id
      pending = promise
      try {
        val next = BiometricPrompt(activity, callbackExecutor, object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { finish(id, resumed) }
          override fun onAuthenticationError(code: Int, message: CharSequence) { finish(id, false) }
        })
        prompt = next
        next.authenticate(BiometricPrompt.PromptInfo.Builder()
          .setTitle(reason)
          .setNegativeButtonText(cancelLabel)
          .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
          .build())
      } catch (_: Exception) {
        if (prompt == null) finish(id, false) else cancelCurrent(id)
      }
    }
  }

  private fun finish(id: String, success: Boolean) {
    if (requestId != id) return
    val result = pending
    requestId = null
    pending = null
    prompt = null
    result?.resolve(success)
  }
  @ReactMethod fun cancel(id: String) { UiThreadUtil.runOnUiThread { cancelCurrent(id) } }
  private fun cancelCurrent(id: String) {
    if (requestId != id || pending == null) return
    val result = pending
    pending = null
    result?.resolve(false)
    // AndroidX shares the Activity callback. Keep busy until its terminal callback drains.
    try { prompt?.cancelAuthentication() } catch (_: Exception) {
      // Fail closed: an unacknowledged cancellation must not admit a replacement prompt.
    }
  }
  override fun onHostResume() { resumed = true }
  override fun onHostPause() { resumed = false; requestId?.let { cancelCurrent(it) } }
  override fun onHostDestroy() { resumed = false; requestId?.let { cancelCurrent(it) } }
  override fun invalidate() {
    UiThreadUtil.runOnUiThread { resumed = false; requestId?.let { cancelCurrent(it) } }
    context.removeLifecycleEventListener(this)
    super.invalidate()
  }
}
