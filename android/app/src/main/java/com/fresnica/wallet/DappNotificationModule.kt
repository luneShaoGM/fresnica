package com.fresnica.wallet

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.facebook.react.common.LifecycleState
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DappNotificationModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
  private var nextNotificationAt = 0L

  override fun getName() = "DappNotification"

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun monotonicTime(): Double = SystemClock.elapsedRealtime().toDouble()

  // NotificationManager is thread-safe. Do not queue delivery on the UI thread:
  // JS validates the document and consent immediately before this blocking call.
  @ReactMethod(isBlockingSynchronousMethod = true)
  fun show(origin: String, title: String, body: String, expiresAt: Double): Boolean {
    val activity = context.currentActivity ?: return false
    val now = SystemClock.elapsedRealtime()
    val remainingMs = expiresAt - now
    if (!expiresAt.isFinite() || expiresAt % 1.0 != 0.0 || remainingMs <= 0 || remainingMs > 5_000) return false
    if (context.lifecycleState != LifecycleState.RESUMED || !activity.hasWindowFocus() ||
        now < nextNotificationAt || title.isBlank() || title.length > 64 ||
        body.isBlank() || body.length > 256) return false

    val manager = context.getSystemService(NotificationManager::class.java)
    val channelId = "dapp_local"
    return try {
      if (!manager.areNotificationsEnabled()) return false
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(
            NotificationChannel(channelId, context.getString(R.string.dapp_notifications), NotificationManager.IMPORTANCE_DEFAULT))
        if (manager.getNotificationChannel(channelId)?.importance == NotificationManager.IMPORTANCE_NONE) return false
      }
      val notification = NotificationCompat.Builder(context, channelId)
          .setSmallIcon(android.R.drawable.ic_dialog_info)
          .setContentTitle(title)
          .setContentText(body)
          .setSubText(origin)
          .setVisibility(NotificationCompat.VISIBILITY_SECRET)
          .setOnlyAlertOnce(true)
          .build()
      if (context.lifecycleState != LifecycleState.RESUMED || !activity.hasWindowFocus()) return false
      if (SystemClock.elapsedRealtime() >= expiresAt) return false
      manager.notify("dapp-local", 1, notification)
      nextNotificationAt = now + 10_000L
      true
    } catch (_: RuntimeException) {
      false
    }
  }
}
