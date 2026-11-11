package com.fresnica.wallet

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState

// OS identity check for App access only. No wallet key or SDK operation is involved.
class SessionAuthenticationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
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
      if (!resumed || activity == null || pending != null || id.isBlank() || reason.isBlank() || cancelLabel.isBlank()) {
        promise.reject("session-auth-unavailable", "session-auth-unavailable")
        return@runOnUiThread
      }
      requestId = id
      pending = promise
      try {
        val next = BiometricPrompt(activity, ContextCompat.getMainExecutor(context), object : BiometricPrompt.AuthenticationCallback() {
          override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { finish(id, resumed) }
          override fun onAuthenticationError(code: Int, message: CharSequence) { finish(id, false) }
        })
        prompt = next
        next.authenticate(BiometricPrompt.PromptInfo.Builder()
          .setTitle(reason)
          .setNegativeButtonText(cancelLabel)
          .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
          .build())
      } catch (_: Exception) { finish(id, false) }
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
    if (requestId != id) return
    val current = prompt
    finish(id, false)
    current?.cancelAuthentication()
  }
  override fun onHostResume() { resumed = true }
  override fun onHostPause() { resumed = false; requestId?.let { cancelCurrent(it) } }
  override fun onHostDestroy() { resumed = false; requestId?.let { cancelCurrent(it) } }
  override fun invalidate() {
    UiThreadUtil.runOnUiThread { requestId?.let { cancelCurrent(it) } }
    context.removeLifecycleEventListener(this)
    super.invalidate()
  }
}
