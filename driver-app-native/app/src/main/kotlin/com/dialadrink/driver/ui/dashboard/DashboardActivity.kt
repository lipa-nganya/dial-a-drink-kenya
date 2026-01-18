package com.dialadrink.driver.ui.dashboard

import android.Manifest
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityDashboardBinding
import com.dialadrink.driver.data.preloader.GlobalPreloader
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.ui.orders.ActiveOrdersActivity
import com.dialadrink.driver.ui.orders.PendingOrdersActivity
import com.dialadrink.driver.utils.PermissionHelper
import com.dialadrink.driver.utils.SharedPrefs
import com.dialadrink.driver.services.SocketService
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.UpdateDriverStatusRequest

class DashboardActivity : AppCompatActivity() {
    private lateinit var binding: ActivityDashboardBinding
    private var currentShiftStatus: String = "offline" // Track current shift status
    private var lastStatusUpdateTime: Long = 0 // Track when we last updated status to prevent immediate reload
    
    // Permission launcher for Android 13+
    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            android.util.Log.d("DashboardActivity", "✅ Notification permission granted")
            PermissionHelper.logPermissionStatus(this)
        } else {
            android.util.Log.w("DashboardActivity", "❌ Notification permission denied")
            showPermissionDeniedDialog()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            binding = ActivityDashboardBinding.inflate(layoutInflater)
            setContentView(binding.root)
            
            setSupportActionBar(binding.toolbar)
            supportActionBar?.setDisplayShowTitleEnabled(false)
            
            setupToolbar()
            setupClickListeners()
            setupShiftToggle()
            setupSocketConnection()
            loadPendingOrdersCount()
            loadDriverStatus()
            
            // Preload critical data in background (non-blocking)
            GlobalPreloader.preloadCriticalData(this)
            
            // Check and request notification permissions
            checkAndRequestNotificationPermission()
            
            // Check and request overlay permission
            checkAndRequestOverlayPermission()
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Error in onCreate: ${e.message}", e)
            throw e
        }
    }
    
    private fun checkAndRequestNotificationPermission() {
        PermissionHelper.logPermissionStatus(this)
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Android 13+ requires runtime permission
            if (!PermissionHelper.hasNotificationPermission(this)) {
                android.util.Log.d("DashboardActivity", "📋 Requesting POST_NOTIFICATIONS permission")
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                android.util.Log.d("DashboardActivity", "✅ Notification permission already granted")
            }
        } else {
            // Android 12 and below - check if notifications are enabled
            if (!PermissionHelper.areNotificationsEnabled(this)) {
                android.util.Log.w("DashboardActivity", "⚠️ Notifications are disabled in system settings")
                showNotificationSettingsDialog()
            } else {
                android.util.Log.d("DashboardActivity", "✅ Notifications are enabled")
            }
        }
    }
    
    private fun showPermissionDeniedDialog() {
        val dialog = AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Notification Permission Required")
            .setMessage("Push notifications are required to receive new orders. Please enable notifications in app settings.")
            .setPositiveButton("Open Settings") { _, _ ->
                openNotificationSettings()
            }
            .setNegativeButton("Cancel", null)
            .create()
        
        dialog.show()
    }
    
    private fun showNotificationSettingsDialog() {
        val dialog = AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Notifications Disabled")
            .setMessage("Push notifications are disabled. Please enable them in system settings to receive new orders.")
            .setPositiveButton("Open Settings") { _, _ ->
                openNotificationSettings()
            }
            .setNegativeButton("Cancel", null)
            .create()
        
        dialog.show()
    }
    
    private fun openNotificationSettings() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, packageName)
            }
            startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Error opening notification settings: ${e.message}", e)
            // Fallback to general app settings
            try {
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = android.net.Uri.fromParts("package", packageName, null)
                }
                startActivity(intent)
            } catch (e2: Exception) {
                android.util.Log.e("DashboardActivity", "Error opening app settings: ${e2.message}", e2)
            }
        }
    }
    
    private fun checkAndRequestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                android.util.Log.d("DashboardActivity", "⚠️ Overlay permission not granted")
                // Don't show dialog automatically - wait for user to need it
            } else {
                android.util.Log.d("DashboardActivity", "✅ Overlay permission granted")
            }
        }
    }
    
    private fun setupToolbar() {
        try {
            val driverName = SharedPrefs.getDriverName(this) ?: "Driver"
            binding.driverNameText.text = "Hi $driverName"
        } catch (e: Exception) {
            android.util.Log.e("DashboardActivity", "Error in setupToolbar: ${e.message}", e)
        }
    }
    
    private fun animateCardClick(view: View) {
        val scaleX = ObjectAnimator.ofFloat(view, "scaleX", 1f, 0.95f, 1f)
        val scaleY = ObjectAnimator.ofFloat(view, "scaleY", 1f, 0.95f, 1f)
        val animatorSet = AnimatorSet()
        animatorSet.playTogether(scaleX, scaleY)
        animatorSet.duration = 200
        animatorSet.interpolator = DecelerateInterpolator()
        animatorSet.start()
    }
    
    private fun setupClickListeners() {
        // Pending orders
        binding.pendingCard.setOnClickListener {
            animateCardClick(binding.pendingCard)
            val intent = Intent(this, PendingOrdersActivity::class.java)
            startActivity(intent)
        }
        
        // In Progress orders
        binding.inProgressCard.setOnClickListener {
            animateCardClick(binding.inProgressCard)
            val intent = Intent(this, ActiveOrdersActivity::class.java)
            startActivity(intent)
        }
        
        // Completed orders
        binding.completedCard.setOnClickListener {
            animateCardClick(binding.completedCard)
            val intent = Intent(this, com.dialadrink.driver.ui.orders.CompletedOrdersActivity::class.java)
            startActivity(intent)
        }
        
        // Cancelled orders
        binding.cancelledCard.setOnClickListener {
            animateCardClick(binding.cancelledCard)
            val intent = Intent(this, com.dialadrink.driver.ui.orders.CancelledOrdersActivity::class.java)
            startActivity(intent)
        }
        
        // Cash At Hand
        binding.cashAtHandCard.setOnClickListener {
            animateCardClick(binding.cashAtHandCard)
            val intent = Intent(this, com.dialadrink.driver.ui.wallet.CashAtHandActivity::class.java)
            startActivity(intent)
        }
        
        // My Wallet
        binding.paymentsCard.setOnClickListener {
            animateCardClick(binding.paymentsCard)
            val intent = Intent(this, com.dialadrink.driver.ui.wallet.MyWalletActivity::class.java)
            startActivity(intent)
        }
        
        // Notifications
        binding.notificationsCard.setOnClickListener {
            animateCardClick(binding.notificationsCard)
            val intent = Intent(this, com.dialadrink.driver.ui.notifications.NotificationsActivity::class.java)
            startActivity(intent)
        }
        
        // Load notifications count to show indicator
        loadNotificationsCount()
        
        // Profile
        binding.profileCard.setOnClickListener {
            animateCardClick(binding.profileCard)
            val intent = Intent(this, com.dialadrink.driver.ui.profile.ProfileActivity::class.java)
            startActivity(intent)
        }
    }
    
    private fun loadPendingOrdersCount() {
        lifecycleScope.launch {
            try {
                val pendingOrders = OrderRepository.getPendingOrders(this@DashboardActivity, forceRefresh = false)
                val count = pendingOrders.size
                binding.pendingCountText.text = count.toString()
                
                // Update count when returning from PendingOrdersActivity
                // This will be called in onResume as well
            } catch (e: Exception) {
                android.util.Log.e("DashboardActivity", "Error loading pending orders count: ${e.message}", e)
            }
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Refresh pending orders count when returning to dashboard
        loadPendingOrdersCount()
        // Refresh notifications count
        loadNotificationsCount()
        // Refresh driver status when returning to dashboard (but not immediately after an update)
        // Only reload if more than 5 seconds have passed since last status update
        // This prevents reloading immediately after a toggle, even if the backend is slow
        val timeSinceLastUpdate = System.currentTimeMillis() - lastStatusUpdateTime
        if (timeSinceLastUpdate > 5000) {
            loadDriverStatus()
        }
    }
    
    private fun loadNotificationsCount() {
        val driverId = SharedPrefs.getDriverId(this) ?: return
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getNotifications(driverId)
                
                if (response.isSuccessful && response.body()?.data != null) {
                    val notifications = response.body()!!.data!!
                    val unreadCount = notifications.count { !it.isRead }
                    
                    // Show/hide red dot indicator
                    binding.notificationIndicator.visibility = if (unreadCount > 0) View.VISIBLE else View.GONE
                } else {
                    // Hide indicator on error
                    binding.notificationIndicator.visibility = View.GONE
                }
            } catch (e: Exception) {
                // Hide indicator on error
                binding.notificationIndicator.visibility = View.GONE
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        SocketService.disconnect()
    }
    
    private fun setupSocketConnection() {
        val driverId = SharedPrefs.getDriverId(this) ?: return
        
        SocketService.connect(
            driverId = driverId,
            onOrderAssigned = {
                loadPendingOrdersCount()
            },
            onOrderStatusUpdated = {
                loadPendingOrdersCount()
            },
            onPaymentConfirmed = null
        )
    }
    
    private fun setupShiftToggle() {
        binding.shiftToggleButton.setOnClickListener {
            toggleShift()
        }
    }
    
    private fun loadDriverStatus() {
        val driverPhone = SharedPrefs.getDriverPhone(this) ?: return
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@DashboardActivity)
                }
                
                val response = ApiClient.getApiService().getDriverByPhone(driverPhone)
                if (response.isSuccessful && response.body()?.success == true) {
                    val driver = response.body()!!.data
                    if (driver != null) {
                        val status = driver.status ?: "offline"
                        currentShiftStatus = status
                        updateShiftToggleUI(status)
                    }
                } else {
                    // Don't update UI on failure - keep current status
                    android.util.Log.w("DashboardActivity", "Failed to load driver status: ${response.code()}")
                }
            } catch (e: Exception) {
                // Don't update UI on error - keep current status
                // Only log the error, don't revert the status
                android.util.Log.e("DashboardActivity", "Error loading driver status: ${e.message}", e)
            }
        }
    }
    
    private fun toggleShift() {
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Toast.makeText(this, "Driver ID not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        // Determine new status based on current status
        val newStatus = if (currentShiftStatus == "active") "offline" else "active"
        
        // Update status on backend first (don't update UI optimistically)
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@DashboardActivity)
                }
                
                val updateResponse = ApiClient.getApiService().updateDriverStatus(
                    driverId,
                    UpdateDriverStatusRequest(status = newStatus)
                )
                
                if (updateResponse.isSuccessful) {
                    val body = updateResponse.body()
                    if (body?.success == true && body?.data != null) {
                        // Success - update our tracked status and UI
                        currentShiftStatus = newStatus
                        lastStatusUpdateTime = System.currentTimeMillis() // Track when we updated
                        updateShiftToggleUI(newStatus)
                        Toast.makeText(
                            this@DashboardActivity,
                            if (newStatus == "active") "Shift started" else "Shift ended",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        // Failed - don't update UI
                        val errorMessage = body?.error ?: "Failed to update shift status"
                        Toast.makeText(this@DashboardActivity, errorMessage, Toast.LENGTH_SHORT).show()
                    }
                } else {
                    // Failed - don't update UI
                    // Try to parse error body
                    val errorMessage = try {
                        val errorBody = updateResponse.errorBody()?.string()
                        if (errorBody != null) {
                            val errorJson = ApiClient.gson.fromJson(errorBody, Map::class.java) as? Map<*, *>
                            (errorJson?.get("error") as? String) ?: "Failed to update shift status"
                        } else {
                            "Failed to update shift status"
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("DashboardActivity", "Error parsing error body: ${e.message}", e)
                        "Failed to update shift status"
                    }
                    Toast.makeText(this@DashboardActivity, errorMessage, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                // Error - don't update UI, but also don't revert since we never changed it
                android.util.Log.e("DashboardActivity", "Error toggling shift: ${e.message}", e)
                val errorMsg = if (e is java.net.SocketTimeoutException) {
                    "Request timed out. Please check your connection and try again."
                } else {
                    "Error: ${e.message}"
                }
                Toast.makeText(this@DashboardActivity, errorMsg, Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun updateShiftToggleUI(status: String) {
        val isOnShift = status == "active"
        
        binding.shiftToggleButton.text = if (isOnShift) "ON SHIFT" else "OFF SHIFT"
        
        // Use ColorStateList to set backgroundTint
        val colorRes = if (isOnShift) android.R.color.holo_green_dark else android.R.color.holo_red_dark
        val colorStateList = ColorStateList.valueOf(getColor(colorRes))
        binding.shiftToggleButton.backgroundTintList = colorStateList
    }
}
