package com.dialadrink.driver.ui.notifications

import android.app.KeyguardManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.dialadrink.driver.databinding.ActivityTestNotificationOverlayBinding
import com.dialadrink.driver.utils.SharedPrefs

class TestNotificationOverlayActivity : AppCompatActivity() {
    private lateinit var binding: ActivityTestNotificationOverlayBinding
    private var handler: Handler? = null
    private var dismissRunnable: Runnable? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        try {
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
            
            binding = ActivityTestNotificationOverlayBinding.inflate(layoutInflater)
            setContentView(binding.root)
            
            // Full screen overlay
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
            
            // Get driver name and display
            val driverName = SharedPrefs.getDriverName(this) ?: "Driver"
            binding.driverNameText.text = "Hi $driverName"
            
            // Auto-dismiss after 3 seconds
            handler = Handler(Looper.getMainLooper())
            dismissRunnable = Runnable {
                try {
                    finish()
                } catch (e: Exception) {
                    // Ignore errors when finishing
                }
            }
            handler?.postDelayed(dismissRunnable!!, 3000)
        } catch (e: Exception) {
            android.util.Log.e("TestNotificationOverlay", "Error in onCreate", e)
            finish()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Clean up handler to prevent leaks
        dismissRunnable?.let { handler?.removeCallbacks(it) }
        handler = null
        dismissRunnable = null
    }
    
    override fun finish() {
        try {
            super.finish()
            // Add fade out animation
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        } catch (e: Exception) {
            // Ignore errors
            super.finish()
        }
    }
}

