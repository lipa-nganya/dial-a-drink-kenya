package com.dialadrink.driver.utils

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object PermissionHelper {
    private const val TAG = "PermissionHelper"
    
    /**
     * Check if notification permission is granted
     */
    fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ requires POST_NOTIFICATIONS permission
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            // Android 12 and below - check if notifications are enabled
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
    }
    
    /**
     * Check if notifications are enabled in system settings
     */
    fun areNotificationsEnabled(context: Context): Boolean {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        return notificationManager.areNotificationsEnabled()
    }
    
    /**
     * Get permission status message for logging
     */
    fun getPermissionStatus(context: Context): String {
        val hasPermission = hasNotificationPermission(context)
        val areEnabled = areNotificationsEnabled(context)
        
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
                "POST_NOTIFICATIONS permission: ${if (hasPermission) "GRANTED" else "DENIED"}, " +
                "System notifications: ${if (areEnabled) "ENABLED" else "DISABLED"}"
            }
            else -> {
                "System notifications: ${if (areEnabled) "ENABLED" else "DISABLED"}"
            }
        }
    }
    
    /**
     * Log current permission status
     */
    fun logPermissionStatus(context: Context) {
        val status = getPermissionStatus(context)
        Log.d(TAG, "📋 Notification Permission Status: $status")
        
        if (!hasNotificationPermission(context)) {
            Log.w(TAG, "⚠️ Notification permission is NOT granted!")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Log.w(TAG, "⚠️ Please request POST_NOTIFICATIONS permission")
            }
        } else {
            Log.d(TAG, "✅ Notification permission is granted")
        }
    }
    
    /**
     * Check if "Appear on top" (SYSTEM_ALERT_WINDOW) permission is granted
     */
    fun hasOverlayPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true // Not required on older versions
        }
    }
    
    /**
     * Get intent to open overlay permission settings
     */
    fun getOverlayPermissionIntent(context: Context): Intent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            )
        } else {
            Intent(Settings.ACTION_SETTINGS)
        }
    }
    
    /**
     * Log overlay permission status
     */
    fun logOverlayPermissionStatus(context: Context) {
        val hasPermission = hasOverlayPermission(context)
        Log.d(TAG, "📋 Overlay Permission Status: ${if (hasPermission) "GRANTED" else "DENIED"}")
        
        if (!hasPermission) {
            Log.w(TAG, "⚠️ Overlay permission is NOT granted!")
            Log.w(TAG, "⚠️ App cannot appear on top of other apps")
            Log.w(TAG, "⚠️ This is required to bring app to foreground from background")
        } else {
            Log.d(TAG, "✅ Overlay permission is granted")
        }
    }
}

