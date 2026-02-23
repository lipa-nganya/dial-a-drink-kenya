package com.dialadrink.driver.services

import android.app.ActivityManager
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.dialadrink.driver.R
import com.dialadrink.driver.ui.main.MainActivity
import com.dialadrink.driver.ui.orders.OrderAcceptanceActivity
import com.dialadrink.driver.ui.notifications.TestNotificationOverlayActivity
import com.dialadrink.driver.ui.notifications.NotificationsActivity
import com.dialadrink.driver.ui.wallet.CashAtHandActivity
import com.dialadrink.driver.utils.PermissionHelper
import com.dialadrink.driver.utils.SharedPrefs
import com.dialadrink.driver.data.model.PushNotification
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class DriverFirebaseMessagingService : FirebaseMessagingService() {
    private val TAG = "FCMService"
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token: $token")
        // Token will be registered on next login
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d(TAG, "📬 [FCM] Message received - data: ${remoteMessage.data}")
        Log.d(TAG, "📬 [FCM] Notification title: ${remoteMessage.notification?.title}, body: ${remoteMessage.notification?.body}")
        
        // Check if message contains data payload
        if (remoteMessage.data.isNotEmpty()) {
            val orderId = remoteMessage.data["orderId"]?.toIntOrNull()
            val type = remoteMessage.data["type"]
            
            if (type == "test-notification") {
                // Bring app to foreground first, then show notification
                showTestNotificationOverlay()
                showTestNotification(remoteMessage)
                return
            } else if (type == "order-assigned" && orderId != null) {
                // Clear cache so pending orders list refreshes with new order
                handleOrderAssigned(orderId)
                
                // Always launch activity and show notification (works in foreground and background)
                // When app is in background, FCM will handle the notification automatically
                // When app is in foreground, onMessageReceived is called and we handle it here
                wakeDeviceAndUnlock()
                launchOrderAcceptanceActivity(orderId, remoteMessage)
                
                // Show notification even if activity is launched (for background cases)
                // The notification ensures the user is alerted even if activity fails to launch
                showOrderNotification(remoteMessage, orderId)
                return
            } else if (type == "order-reassigned" && orderId != null) {
                handleOrderReassigned(orderId)
                showOrderNotification(remoteMessage, orderId)
                return
            } else if (type == "cash_submission_approved" || type == "cash_submission_rejected") {
                val submissionId = remoteMessage.data["submissionId"]
                handleCashSubmissionNotification(type, submissionId, remoteMessage)
                return
            } else if (type == "custom-notification") {
                // Handle admin custom notifications - open NotificationsActivity
                handleCustomNotification(remoteMessage)
                return
            } else if (type == "cancellation-approved") {
                // Handle cancellation approval notification
                handleCancellationApproved(remoteMessage)
                return
            } else if (type == "payment-success" || type == "payment-failed") {
                // Handle payment success/failure notifications
                handlePaymentNotification(type, remoteMessage)
                return
            } else if (type == "inventory-check-approved" || type == "inventory-check-rejected") {
                // Handle inventory check approval/rejection notifications
                handleInventoryCheckNotification(type, remoteMessage)
                return
            }
        }
        
        // If message has data but type is not recognized, or has notification field
        // Show notification for messages with notification field even if data is empty
        if (remoteMessage.notification != null) {
            Log.d(TAG, "📬 [FCM] Showing notification with notification field")
            showNotification(remoteMessage)
        } else if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "📬 [FCM] Showing notification with data only (type: ${remoteMessage.data["type"]})")
            showNotification(remoteMessage)
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "order-assignments",
                "Order Assignments",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new order assignments"
                enableVibration(true)
                vibrationPattern = longArrayOf(500, 100, 500, 100, 500, 100, 500)
                enableLights(true)
                setShowBadge(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "✅ Notification channel created: order-assignments")
            
            // Create notifications channel for admin custom notifications
            val notificationsChannel = NotificationChannel(
                "notifications",
                "Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications from admin"
                enableVibration(true)
                vibrationPattern = longArrayOf(500, 100, 500, 100, 500, 100, 500)
                enableLights(true)
                setShowBadge(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(notificationsChannel)
            Log.d(TAG, "✅ Notification channel created: notifications")
            
            // Create cash submissions notification channel
            val cashChannel = NotificationChannel(
                "cash-submissions",
                "Cash Submissions",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for cash submission approvals and rejections"
                enableVibration(true)
                vibrationPattern = longArrayOf(500, 100, 500)
                enableLights(true)
                setShowBadge(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(cashChannel)
            Log.d(TAG, "✅ Notification channel created: cash-submissions")
        }
    }
    
    private fun showOrderNotification(remoteMessage: RemoteMessage, orderId: Int) {
        try {
            // Save push notification to SharedPrefs
            savePushNotification(remoteMessage, orderId)
            
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show order notification: Permission not granted")
                PermissionHelper.logPermissionStatus(this)
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show order notification: Notifications disabled in system settings")
                return
            }
            
            // Bring app to foreground when order notification is received
            val intent = Intent(this, com.dialadrink.driver.ui.orders.OrderAcceptanceActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
                putExtra("orderId", orderId)
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this, orderId, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            val notificationBuilder = NotificationCompat.Builder(this, "order-assignments")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(remoteMessage.notification?.title ?: "🚨 New Order Assigned!")
                .setContentText(remoteMessage.notification?.body ?: "Tap to view order details")
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_MAX) // Use MAX priority for order notifications
                .setDefaults(NotificationCompat.DEFAULT_ALL) // This includes sound, vibration, and lights
                .setVibrate(longArrayOf(500, 100, 500, 100, 500, 100, 500))
                .setLights(0xFF00E0B8.toInt(), 1000, 1000)
                .setCategory(NotificationCompat.CATEGORY_ALARM) // Category alarm ensures sound plays even in Do Not Disturb
                .setFullScreenIntent(pendingIntent, true) // Show as heads-up notification (works in background too)
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(orderId, notificationBuilder.build())
            Log.d(TAG, "✅ Order notification displayed for order #$orderId")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error showing order notification", e)
        }
    }
    
    /**
     * Helper function to save push notification to SharedPrefs
     */
    private fun savePushNotification(remoteMessage: RemoteMessage, notificationId: Int? = null) {
        try {
            val title = remoteMessage.notification?.title 
                ?: remoteMessage.data["title"] 
                ?: "Notification"
            val body = remoteMessage.notification?.body 
                ?: remoteMessage.data["body"] 
                ?: remoteMessage.data["message"] 
                ?: ""
            
            val id = notificationId ?: remoteMessage.data["notificationId"]?.toIntOrNull() ?: System.currentTimeMillis().toInt()
            
            val notification = PushNotification(
                id = id,
                title = title,
                preview = body.take(100), // Preview is first 100 chars
                message = body,
                sentAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault()).format(java.util.Date()),
                isRead = false
            )
            
            SharedPrefs.addPushNotification(this, notification)
            Log.d(TAG, "✅ Push notification saved to SharedPrefs: $title")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error saving push notification to SharedPrefs", e)
        }
    }
    
    private fun showTestNotification(remoteMessage: RemoteMessage) {
        try {
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show notification: Permission not granted")
                PermissionHelper.logPermissionStatus(this)
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show notification: Notifications disabled in system settings")
                return
            }
            
            // Build intent for overlay activity - bring app to foreground
            val intent = Intent(this, TestNotificationOverlayActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                // Bring app to foreground
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this, 999, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            // Create system notification with sound, vibration, and LED
            // Always show notification even when app is in foreground
            val notificationBuilder = NotificationCompat.Builder(this, "order-assignments")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(remoteMessage.notification?.title ?: "Test Notification")
                .setContentText(remoteMessage.notification?.body ?: "Test push notification")
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setVibrate(longArrayOf(500, 100, 500, 100, 500, 100, 500))
                .setLights(0xFF00E0B8.toInt(), 1000, 1000)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(999, notificationBuilder.build())
            Log.d(TAG, "✅ Test notification displayed in system tray")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error showing test notification", e)
        }
    }
    
    private fun showTestNotificationOverlay() {
        try {
            // Check overlay permission
            if (!PermissionHelper.hasOverlayPermission(this)) {
                Log.w(TAG, "❌ Cannot show overlay: Overlay permission not granted")
                PermissionHelper.logOverlayPermissionStatus(this)
                // Still try to launch - it might work without overlay permission
            }
            
            // Wake device and unlock screen if needed
            wakeDeviceAndUnlock()
            
            // Bring app task to front first
            bringAppToForeground()
            
            // Bring app to foreground and show overlay
            val intent = Intent(this, TestNotificationOverlayActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
                // Critical flags to bring app to foreground
                addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                // Bring to front
                addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
            }
            startActivity(intent)
            Log.d(TAG, "✅ Test notification overlay launched - app brought to foreground")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error launching test notification overlay", e)
        }
    }
    
    private fun bringAppToForeground() {
        try {
            val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val appPackageName = packageName
            
            // Method 1: Use launch intent to bring app to front (most reliable)
            val launchIntent = packageManager.getLaunchIntentForPackage(appPackageName)
            launchIntent?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            launchIntent?.let { 
                startActivity(it)
                Log.d(TAG, "✅ App brought to foreground via launch intent")
            }
            
            // Method 2: Try to move task to front (for Android versions that support it)
            try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    // getRunningTasks is deprecated but works on older versions
                    @Suppress("DEPRECATION")
                    val tasks = activityManager.getRunningTasks(10)
                    for (taskInfo in tasks) {
                        if (taskInfo.topActivity?.packageName == appPackageName) {
                            @Suppress("DEPRECATION")
                            activityManager.moveTaskToFront(
                                taskInfo.id,
                                ActivityManager.MOVE_TASK_WITH_HOME
                            )
                            Log.d(TAG, "✅ App task moved to front (task ID: ${taskInfo.id})")
                            break
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Could not use moveTaskToFront (may require special permissions)", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error bringing app to foreground", e)
        }
    }
    
    private fun launchOrderAcceptanceActivity(orderId: Int, remoteMessage: RemoteMessage) {
        try {
            wakeDeviceAndUnlock()
            bringAppToForeground()
            
            val customerName = remoteMessage.data["customerName"]
            val deliveryAddress = remoteMessage.data["deliveryAddress"]
            val totalAmount = remoteMessage.data["totalAmount"]?.toDoubleOrNull() ?: 0.0
            val orderJson = remoteMessage.data["order"] // JSON string fallback
            
            val intent = Intent(this, com.dialadrink.driver.ui.orders.OrderAcceptanceActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
                addFlags(Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
                addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT)
                putExtra("orderId", orderId)
                if (!customerName.isNullOrBlank()) putExtra("customerName", customerName)
                if (!deliveryAddress.isNullOrBlank()) putExtra("deliveryAddress", deliveryAddress)
                if (totalAmount > 0) putExtra("totalAmount", totalAmount)
                if (!orderJson.isNullOrBlank()) putExtra("order", orderJson) // Pass JSON as fallback
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error launching OrderAcceptanceActivity", e)
        }
    }
    
    private fun handleCashSubmissionNotification(type: String, submissionId: String?, remoteMessage: RemoteMessage) {
        try {
            // Save push notification to SharedPrefs
            savePushNotification(remoteMessage, submissionId?.toIntOrNull())
            
            val intent = Intent(this, com.dialadrink.driver.ui.wallet.CashAtHandActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                putExtra("type", type)
                if (!submissionId.isNullOrBlank()) {
                    putExtra("submissionId", submissionId)
                }
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this, submissionId?.toIntOrNull() ?: 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            val notificationBuilder = NotificationCompat.Builder(this, "cash-submissions")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(remoteMessage.notification?.title ?: "Cash Submission Update")
                .setContentText(remoteMessage.notification?.body ?: "")
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
            
            // Also launch activity directly if app is in foreground
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling cash submission notification", e)
        }
    }
    
    private fun handleCustomNotification(remoteMessage: RemoteMessage) {
        try {
            val notificationId = remoteMessage.data["notificationId"]?.toIntOrNull() ?: System.currentTimeMillis().toInt()
            
            // Save push notification to SharedPrefs
            savePushNotification(remoteMessage, notificationId)
            
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show custom notification: Permission not granted")
                PermissionHelper.logPermissionStatus(this)
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show custom notification: Notifications disabled in system settings")
                return
            }
            
            // Bring app to foreground
            bringAppToForeground()
            
            // Create intent to open NotificationsActivity
            val intent = Intent(this, NotificationsActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this, notificationId, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            val notificationBuilder = NotificationCompat.Builder(this, "order-assignments")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "New Notification")
                .setContentText(remoteMessage.notification?.body ?: remoteMessage.data["preview"] ?: "")
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(notificationId, notificationBuilder.build())
            Log.d(TAG, "✅ Custom notification displayed and will open NotificationsActivity on click")
            
            // Also launch activity directly to bring app to foreground
            try {
                startActivity(intent)
                Log.d(TAG, "✅ NotificationsActivity launched from custom notification")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error launching NotificationsActivity", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling custom notification", e)
        }
    }
    
    private fun handleCancellationApproved(remoteMessage: RemoteMessage) {
        try {
            val orderId = remoteMessage.data["orderId"]?.toIntOrNull()
            val message = remoteMessage.data["message"] ?: remoteMessage.notification?.body ?: "Your cancellation request has been approved"
            
            Log.d(TAG, "📬 Cancellation approved notification received for order: $orderId")
            
            // Save push notification to SharedPrefs
            savePushNotification(remoteMessage, orderId)
            
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show cancellation notification: Permission not granted")
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show cancellation notification: Notifications disabled")
                return
            }
            
            // Bring app to foreground
            bringAppToForeground()
            
            // Create intent to open DashboardActivity (driver can now accept new orders)
            val intent = Intent(this, com.dialadrink.driver.ui.dashboard.DashboardActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            
            val notificationId = orderId ?: System.currentTimeMillis().toInt()
            
            val pendingIntent = PendingIntent.getActivity(
                this, notificationId, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            val notificationBuilder = NotificationCompat.Builder(this, "notifications")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(remoteMessage.notification?.title ?: "✅ Cancellation Approved")
                .setContentText(message)
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(notificationId, notificationBuilder.build())
            
            Log.d(TAG, "✅ Cancellation approval notification displayed")
            
            // Also launch activity directly if app is in foreground
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling cancellation approval notification", e)
        }
    }
    
    private fun handleInventoryCheckNotification(type: String, remoteMessage: RemoteMessage) {
        try {
            val checkId = remoteMessage.data["checkId"]?.toIntOrNull()
            val drinkName = remoteMessage.data["drinkName"] ?: "item"
            val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: 
                        if (type == "inventory-check-approved") "✅ Inventory Check Approved" else "⚠️ Inventory Check Rejected"
            val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: ""
            
            Log.d(TAG, "📬 Inventory check notification received: type=$type, checkId=$checkId")
            
            // Save push notification to SharedPrefs
            savePushNotification(remoteMessage, checkId)
            
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show inventory check notification: Permission not granted")
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show inventory check notification: Notifications disabled")
                return
            }
            
            // Create notification channel for inventory checks if it doesn't exist
            createInventoryCheckNotificationChannel()
            
            // Bring app to foreground
            bringAppToForeground()
            
            // Create intent to open Inventory Check History activity
            val intent = Intent(this, com.dialadrink.driver.ui.shopagent.ShopAgentInventoryCheckHistoryActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
                // Set tab based on type
                putExtra("tab", if (type == "inventory-check-approved") 1 else 2) // 1 = Approved, 2 = Rejected
            }
            
            val notificationId = checkId ?: System.currentTimeMillis().toInt()
            
            val pendingIntent = PendingIntent.getActivity(
                this, notificationId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val notification = NotificationCompat.Builder(this, "inventory-checks")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setVibrate(longArrayOf(500, 100, 500, 100, 500))
                .build()
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.notify(notificationId, notification)
            
            Log.d(TAG, "✅ Inventory check notification displayed")
            
            // Send broadcast to refresh inventory check history if activity is open
            val refreshIntent = Intent("com.dialadrink.driver.INVENTORY_CHECK_REFRESH").apply {
                putExtra("type", type)
                putExtra("checkId", checkId ?: -1)
            }
            LocalBroadcastManager.getInstance(this).sendBroadcast(refreshIntent)
            
            // Also launch activity directly if app is in foreground
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling inventory check notification", e)
        }
    }
    
    private fun createInventoryCheckNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "inventory-checks",
                "Inventory Checks",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for inventory check approvals and rejections"
                enableVibration(true)
                vibrationPattern = longArrayOf(500, 100, 500, 100, 500)
                enableLights(true)
                setShowBadge(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "✅ Notification channel created: inventory-checks")
        }
    }
    
    private fun handlePaymentNotification(type: String, remoteMessage: RemoteMessage) {
        try {
            val orderId = remoteMessage.data["orderId"]?.toIntOrNull()
            val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: 
                        if (type == "payment-success") "✅ Payment Received" else "❌ Payment Failed"
            val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: ""
            val amount = remoteMessage.data["amount"] ?: ""
            val receiptNumber = remoteMessage.data["receiptNumber"] ?: ""
            
            Log.d(TAG, "📬 Payment notification received: type=$type, orderId=$orderId")
            
            // Save push notification to SharedPrefs
            savePushNotification(remoteMessage, orderId)
            
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show payment notification: Permission not granted")
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show payment notification: Notifications disabled")
                return
            }
            
            // Bring app to foreground
            bringAppToForeground()
            
            // Create intent to open NotificationsActivity
            val intent = Intent(this, NotificationsActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
            }
            
            val notificationId = orderId ?: System.currentTimeMillis().toInt()
            
            val pendingIntent = PendingIntent.getActivity(
                this, notificationId, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            val notificationBuilder = NotificationCompat.Builder(this, "notifications")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(notificationId, notificationBuilder.build())
            
            Log.d(TAG, "✅ Payment notification displayed: $type")
            
            // Also launch activity directly if app is in foreground
            try {
                startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error launching NotificationsActivity", e)
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling payment notification", e)
        }
    }
    
    private fun wakeDeviceAndUnlock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            
            // Use FULL_WAKE_LOCK to wake screen and keep it on
            val wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "DialADrink:NotificationWakeLock"
            )
            wakeLock.acquire(10000) // Hold for 10 seconds to ensure activity launches
            Log.d(TAG, "✅ Device woken up with wake lock")
            
            // Note: Screen unlock will be handled by the activity when it launches
            // The activity should use WindowManager flags to show over lock screen
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error waking device", e)
        }
    }
    
    
    private fun showNotification(remoteMessage: RemoteMessage) {
        try {
            // Save push notification to SharedPrefs (for generic notifications)
            savePushNotification(remoteMessage)
            
            // Check permissions before showing notification
            if (!PermissionHelper.hasNotificationPermission(this)) {
                Log.w(TAG, "❌ Cannot show notification: Permission not granted")
                PermissionHelper.logPermissionStatus(this)
                return
            }
            
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                Log.w(TAG, "❌ Cannot show notification: Notifications disabled in system settings")
                return
            }
            
            // Bring app to foreground
            val intent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                addFlags(Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT)
            }
            
            val pendingIntent = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_ONE_SHOT
            )
            
            val notificationBuilder = NotificationCompat.Builder(this, "order-assignments")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(remoteMessage.notification?.title ?: "Dial A Drink")
                .setContentText(remoteMessage.notification?.body ?: "")
                .setAutoCancel(true)
                .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error showing notification", e)
        }
    }
    
    /**
     * Handle order assignment - clear cache so pending orders list refreshes
     * This ensures the newly assigned order appears in the pending list
     */
    private fun handleOrderAssigned(orderId: Int) {
        try {
            Log.d(TAG, "🔄 Handling order assignment for order #$orderId")
            
            // Clear order cache to force refresh (using coroutine scope since clear() is suspend)
            serviceScope.launch {
                try {
                    com.dialadrink.driver.utils.OrderCache.clear()
                    com.dialadrink.driver.utils.SharedPrefs.clearCachedOrders(this@DriverFirebaseMessagingService)
                    Log.d(TAG, "✅ Cache cleared for order assignment")
                    
                    // Send broadcast to notify activities to refresh
                    val intent = Intent("com.dialadrink.driver.ORDER_ASSIGNED").apply {
                        putExtra("orderId", orderId)
                    }
                    LocalBroadcastManager.getInstance(this@DriverFirebaseMessagingService).sendBroadcast(intent)
                    Log.d(TAG, "📡 Broadcast sent for order assignment")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order assignment", e)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling order assignment", e)
        }
    }
    
    /**
     * Handle order reassignment - clear cache and refresh order lists
     * This ensures the reassigned order is removed from driver's lists
     */
    private fun handleOrderReassigned(orderId: Int) {
        try {
            Log.d(TAG, "🔄 Handling order reassignment for order #$orderId")
            
            // Clear order cache to force refresh (using coroutine scope since clear() is suspend)
            serviceScope.launch {
                try {
                    com.dialadrink.driver.utils.OrderCache.clear()
                    com.dialadrink.driver.utils.SharedPrefs.clearCachedOrders(this@DriverFirebaseMessagingService)
                    Log.d(TAG, "✅ Cache cleared for order reassignment")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error clearing order cache", e)
                }
            }
            
            // Note: Order lists will be refreshed when user navigates to those screens
            // or when Socket.IO events are received
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling order reassignment", e)
        }
    }
}

