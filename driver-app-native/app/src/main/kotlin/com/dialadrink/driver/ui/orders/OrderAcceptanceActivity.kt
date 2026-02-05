package com.dialadrink.driver.ui.orders

import android.app.KeyguardManager
import android.content.Intent
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.UpdateOrderStatusRequest
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.databinding.ActivityOrderAcceptanceBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.text.NumberFormat
import java.util.*

class OrderAcceptanceActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOrderAcceptanceBinding
    private var orderId: Int = -1
    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var vibrationPattern: LongArray? = null
    private var vibrationHandler: Handler? = null
    private var vibrationRunnable: Runnable? = null
    private val TAG = "OrderAcceptance"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Show over lock screen and bring to foreground
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                or WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        
        // Keep screen on
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        binding = ActivityOrderAcceptanceBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        orderId = intent.getIntExtra("orderId", -1)
        if (orderId == -1) {
            finish()
            return
        }
        
        // Full screen
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
        
        setupSoundAndVibration()
        loadOrderDetails()
        setupButtons()
    }
    
    private fun setupSoundAndVibration() {
        vibrator = ContextCompat.getSystemService(this, Vibrator::class.java)
        vibrationPattern = longArrayOf(500, 100, 500, 100, 500, 100, 500)
        vibrationHandler = Handler(Looper.getMainLooper())
        
        // Start continuous vibration immediately
        startContinuousVibration()
        
        // Load and play sound file
        try {
            mediaPlayer = MediaPlayer.create(this, R.raw.driver_sound)
            mediaPlayer?.apply {
                isLooping = true
                setVolume(1.0f, 1.0f)
                start()
            }
        } catch (e: Exception) {
        }
    }
    
    private fun startContinuousVibration() {
        // Initial vibration pattern
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(vibrationPattern!!, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(vibrationPattern!!, 0)
        }
        
        // Set up continuous vibration every second
        vibrationRunnable = object : Runnable {
            override fun run() {
                val pattern = longArrayOf(500, 100, 500, 100)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, 0)
                }
                vibrationHandler?.postDelayed(this, 1000)
            }
        }
        vibrationHandler?.postDelayed(vibrationRunnable!!, 1000)
    }
    
    private fun loadOrderDetails() {
        // Try to get order details from intent extras first (from push notification)
        var customerName = intent.getStringExtra("customerName")
        var deliveryAddress = intent.getStringExtra("deliveryAddress")
        var totalAmount = intent.getDoubleExtra("totalAmount", 0.0)
        
        // If not found in direct extras, try parsing from JSON string
        if ((customerName.isNullOrBlank() || deliveryAddress.isNullOrBlank()) && totalAmount <= 0) {
            val orderJson = intent.getStringExtra("order")
            if (!orderJson.isNullOrBlank()) {
                try {
                    val json = org.json.JSONObject(orderJson)
                    customerName = json.optString("customerName", null)
                    deliveryAddress = json.optString("deliveryAddress", null)
                    totalAmount = json.optDouble("totalAmount", 0.0)
                } catch (e: Exception) {
                    // JSON parsing failed, will fall back to API
                }
            }
        }
        
        // If we have valid data from intent, display it immediately
        if (!customerName.isNullOrBlank() && !deliveryAddress.isNullOrBlank()) {
            binding.orderNumberText.text = "Order #$orderId"
            binding.customerNameText.text = customerName
            binding.addressText.text = deliveryAddress
            if (totalAmount > 0) {
                val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
                binding.amountText.text = formatter.format(totalAmount)
            } else {
                binding.amountText.text = ""
            }
        } else {
            // Fallback to API call if data not in intent
            lifecycleScope.launch {
                try {
                    val response = ApiClient.getApiService().getOrderDetails(orderId)
                    if (response.isSuccessful && response.body()?.data != null) {
                        displayOrder(response.body()!!.data!!)
                    } else {
                        // Show error state
                        binding.orderNumberText.text = "Order #$orderId"
                        binding.customerNameText.text = "Loading..."
                        binding.addressText.text = "Loading..."
                        binding.amountText.text = ""
                    }
                } catch (e: Exception) {
                    // Show error state
                    binding.orderNumberText.text = "Order #$orderId"
                    binding.customerNameText.text = "Error loading order"
                    binding.addressText.text = "Please check your connection"
                    binding.amountText.text = ""
                }
            }
        }
    }
    
    private fun displayOrder(order: com.dialadrink.driver.data.model.Order) {
        binding.orderNumberText.text = "Order #${order.id}"
        binding.customerNameText.text = order.customerName
        binding.addressText.text = order.deliveryAddress
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        binding.amountText.text = formatter.format(order.totalAmount)
    }
    
    private fun setupButtons() {
        binding.acceptButton.setOnClickListener {
            acceptOrder()
        }
        
        binding.rejectButton.setOnClickListener {
            rejectOrder()
        }
    }
    
    private fun acceptOrder() {
        stopSoundAndVibration()
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.acceptButton.isEnabled = false
        binding.rejectButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                val result = withTimeoutOrNull(30000) { // 30 second timeout
                    OrderRepository.respondToOrder(
                        this@OrderAcceptanceActivity,
                        orderId,
                        accepted = true
                    )
                }
                
                if (result == null) {
                    // Timeout
                    Toast.makeText(
                        this@OrderAcceptanceActivity,
                        "Request timed out. Please try again.",
                        Toast.LENGTH_SHORT
                    ).show()
                    binding.loadingProgress.visibility = View.GONE
                    binding.acceptButton.isEnabled = true
                    binding.rejectButton.isEnabled = true
                } else {
                    val (success, errorMessage) = result
                    if (success) {
                        Toast.makeText(
                            this@OrderAcceptanceActivity,
                            "Order #$orderId accepted successfully",
                            Toast.LENGTH_SHORT
                        ).show()
                        
                        // Send broadcast to notify active orders screen to refresh
                        val broadcastIntent = Intent("com.dialadrink.driver.ORDER_ACCEPTED").apply {
                            putExtra("orderId", orderId)
                        }
                        LocalBroadcastManager.getInstance(this@OrderAcceptanceActivity).sendBroadcast(broadcastIntent)
                        
                        // Navigate to Active Orders screen to show the accepted order
                        val intent = Intent(this@OrderAcceptanceActivity, ActiveOrdersActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                            putExtra("orderId", orderId) // Pass order ID so ActiveOrdersActivity can highlight it
                            putExtra("acceptedOrderId", orderId) // Also pass as acceptedOrderId for compatibility
                        }
                        startActivity(intent)
                        finish()
                    } else {
                        val message = errorMessage ?: "Failed to accept order. Please try again."
                        Toast.makeText(this@OrderAcceptanceActivity, message, Toast.LENGTH_SHORT).show()
                        binding.loadingProgress.visibility = View.GONE
                        binding.acceptButton.isEnabled = true
                        binding.rejectButton.isEnabled = true
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(
                    this@OrderAcceptanceActivity,
                    "Error accepting order: ${e.message ?: "Unknown error"}",
                    Toast.LENGTH_SHORT
                ).show()
                binding.loadingProgress.visibility = View.GONE
                binding.acceptButton.isEnabled = true
                binding.rejectButton.isEnabled = true
            }
        }
    }
    
    private fun rejectOrder() {
        stopSoundAndVibration()
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.acceptButton.isEnabled = false
        binding.rejectButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                val result = withTimeoutOrNull(30000) { // 30 second timeout
                    OrderRepository.respondToOrder(
                        this@OrderAcceptanceActivity,
                        orderId,
                        accepted = false
                    )
                }
                
                if (result == null) {
                    // Timeout
                    Toast.makeText(
                        this@OrderAcceptanceActivity,
                        "Request timed out. Please try again.",
                        Toast.LENGTH_SHORT
                    ).show()
                    binding.loadingProgress.visibility = View.GONE
                    binding.acceptButton.isEnabled = true
                    binding.rejectButton.isEnabled = true
                } else {
                    val (success, errorMessage) = result
                    if (success) {
                        Toast.makeText(
                            this@OrderAcceptanceActivity,
                            "Order #$orderId rejected. Admin will be notified.",
                            Toast.LENGTH_SHORT
                        ).show()
                        // Navigate to dashboard instead of just finishing
                        val intent = Intent(this@OrderAcceptanceActivity, com.dialadrink.driver.ui.dashboard.DashboardActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                            putExtra("refreshOrders", true)
                        }
                        startActivity(intent)
                        finish()
                    } else {
                        val message = errorMessage ?: "Failed to reject order. Please try again."
                        Toast.makeText(this@OrderAcceptanceActivity, message, Toast.LENGTH_SHORT).show()
                        binding.loadingProgress.visibility = View.GONE
                        binding.acceptButton.isEnabled = true
                        binding.rejectButton.isEnabled = true
                    }
                }
            } catch (e: Exception) {
                Toast.makeText(
                    this@OrderAcceptanceActivity,
                    "Error rejecting order: ${e.message ?: "Unknown error"}",
                    Toast.LENGTH_SHORT
                ).show()
                binding.loadingProgress.visibility = View.GONE
                binding.acceptButton.isEnabled = true
                binding.rejectButton.isEnabled = true
            }
        }
    }
    
    private fun stopSoundAndVibration() {
        // Stop vibration (null-safe: runnable may already be cleared or never set)
        vibrator?.cancel()
        vibrationRunnable?.let { runnable ->
            vibrationHandler?.removeCallbacks(runnable)
        }
        vibrationRunnable = null

        // Stop sound (wrap in try/catch in case player is already released/invalid state)
        try {
            mediaPlayer?.takeIf { it.isPlaying }?.stop()
            mediaPlayer?.release()
        } catch (_: Exception) { /* already stopped/released */ }
        mediaPlayer = null
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopSoundAndVibration()
    }
    
    override fun onPause() {
        super.onPause()
        // Keep sound and vibration going even when app is backgrounded
    }
}

