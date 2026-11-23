package com.fresnica.wallet

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DappNotificationModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {
  private var nextNotificationAt = 0L

  override fun getName() = "DappNotification"

  @ReactMethod
  fun show(origin: String, title: String, body: String, result: Promise) {
    val activity = context.currentActivity
    if (activity == null) {
      result.resolve(false)
      return
    }
    activity.runOnUiThread {
      val now = SystemClock.elapsedRealtime()
      if (!activity.hasWindowFocus() || now < nextNotificationAt ||
          title.isBlank() || title.length > 64 || body.isBlank() || body.length > 256) {
        result.resolve(false)
        return@runOnUiThread
      }

      val manager = context.getSystemService(NotificationManager::class.java)
      val channelId = "dapp_local"
      try {
        if (!manager.areNotificationsEnabled()) {
          result.resolve(false)
          return@runOnUiThread
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          manager.createNotificationChannel(
              NotificationChannel(channelId, context.getString(R.string.dapp_notifications), NotificationManager.IMPORTANCE_DEFAULT))
          if (manager.getNotificationChannel(channelId)?.importance == NotificationManager.IMPORTANCE_NONE) {
            result.resolve(false)
            return@runOnUiThread
          }
        }

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setSubText(origin)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .build()
        manager.notify("dapp-local", 1, notification)
        nextNotificationAt = now + 10_000L
        result.resolve(true)
      } catch (_: RuntimeException) {
        result.resolve(false)
      }
    }
  }
}
