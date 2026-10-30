package com.fresnica.mobile

import androidx.webkit.ProxyConfig
import androidx.webkit.ProxyController
import androidx.webkit.WebViewFeature
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager
import java.util.concurrent.Executor

class DappNetworkGuardPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
      listOf(DappNetworkGuardModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> =
      emptyList()
}

class DappNetworkGuardModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "DappNetworkGuard"

  override fun getConstants(): Map<String, Any> = mapOf("available" to supported())

  @ReactMethod
  fun prepare(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (!supported()) {
        promise.reject("dapp-guard-unavailable", "Update Android System WebView to use the dApp browser.")
      } else if (ready) {
        promise.resolve(null)
      } else {
        waiting.add(promise)
        if (waiting.size == 1) {
          try {
            val proxy = DappTunnelProxy()
            tunnel = proxy
            val config = ProxyConfig.Builder()
                .addProxyRule("http://127.0.0.1:${proxy.port()}")
                .removeImplicitRules()
                .build()
            // Process-wide and never cleared on unmount or React reload. There is
            // no DIRECT fallback, including for loopback/link-local addresses.
            ProxyController.getInstance().setProxyOverride(config, Executor { it.run() }) {
              UiThreadUtil.runOnUiThread {
                ready = true
                val pending = waiting.toList()
                waiting.clear()
                pending.forEach { it.resolve(null) }
              }
            }
          } catch (error: Exception) {
            tunnel?.close()
            val pending = waiting.toList()
            waiting.clear()
            pending.forEach { it.reject("dapp-guard-unavailable", "The secure browser could not start.") }
          }
        }
      }
    }
  }

  companion object {
    // Owned by the app process, independent of account and React context lifetime.
    private var tunnel: DappTunnelProxy? = null
    private var ready = false
    private val waiting = mutableListOf<Promise>()

    private fun supported(): Boolean = try {
      WebViewFeature.isFeatureSupported(WebViewFeature.PROXY_OVERRIDE) &&
          WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
    } catch (unavailable: RuntimeException) {
      false
    }
  }
}
