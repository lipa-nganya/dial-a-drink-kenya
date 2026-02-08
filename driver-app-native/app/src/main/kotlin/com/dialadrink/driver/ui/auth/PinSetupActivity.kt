package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.SetupPinRequest
import com.dialadrink.driver.databinding.ActivityPinSetupBinding
import com.dialadrink.driver.services.FcmService
import com.dialadrink.driver.ui.dashboard.DashboardActivity
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class PinSetupActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPinSetupBinding
    private var phone: String = ""
    private var userType: String = "driver" // "driver" or "admin"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPinSetupBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: ""
        userType = intent.getStringExtra("userType") ?: "driver"
        
        if (phone.isEmpty()) {
            finish()
            return
        }
        
        setupViews()
        
        // Auto-focus PIN input
        binding.pinEditText.requestFocus()
    }
    
    private fun setupViews() {
        // Format PIN inputs to show dots/spacing like React Native
        binding.pinEditText.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) {
                val text = s.toString().replace(Regex("[^0-9]"), "")
                if (text != s.toString()) {
                    binding.pinEditText.setText(text)
                    binding.pinEditText.setSelection(text.length)
                }
            }
        })
        
        binding.confirmPinEditText.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) {
                val text = s.toString().replace(Regex("[^0-9]"), "")
                if (text != s.toString()) {
                    binding.confirmPinEditText.setText(text)
                    binding.confirmPinEditText.setSelection(text.length)
                }
            }
        })
        
        binding.setupPinButton.setOnClickListener {
            setupPin()
        }
    }
    
    private fun setupPin() {
        val pin = binding.pinEditText.text.toString().trim()
        val confirmPin = binding.confirmPinEditText.text.toString().trim()
        
        if (pin.length != 4) {
            showError("PIN must be 4 digits")
            return
        }
        
        if (pin != confirmPin) {
            showError("PINs do not match")
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.setupPinButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                // Clean phone number (remove non-digits) to ensure consistent format
                val cleanedPhone = phone.replace(Regex("[^0-9]"), "")
                android.util.Log.d("PinSetupActivity", "🔐 Setting up PIN for $userType phone: $cleanedPhone")
                
                val response = if (userType == "admin") {
                    // Admin PIN setup
                    ApiClient.getApiService().setupAdminPin(
                        cleanedPhone,
                        SetupPinRequest(pin)
                    )
                } else {
                    // Driver PIN setup
                    ApiClient.getApiService().setupPin(
                        cleanedPhone,
                        SetupPinRequest(pin)
                    )
                }
                
                android.util.Log.d("PinSetupActivity", "📡 PIN setup response - Success: ${response.isSuccessful}, Code: ${response.code()}")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    android.util.Log.d("PinSetupActivity", "✅ PIN setup successful for $userType")
                    
                    if (userType == "admin") {
                        // Mark admin as logged in
                        SharedPrefs.setAdminLoggedIn(this@PinSetupActivity, true)
                        
                        // Navigate to admin dashboard
                        val intent = Intent(this@PinSetupActivity, com.dialadrink.driver.ui.admin.AdminDashboardActivity::class.java)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        startActivity(intent)
                    } else {
                        // Mark driver as logged in
                        SharedPrefs.setLoggedIn(this@PinSetupActivity, true)
                        
                        // Register for push notifications
                        val driverId = SharedPrefs.getDriverId(this@PinSetupActivity)
                        if (driverId != null) {
                            FcmService.registerPushToken(this@PinSetupActivity, driverId)
                        }
                        
                        // Navigate to driver dashboard
                        val intent = Intent(this@PinSetupActivity, DashboardActivity::class.java)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        startActivity(intent)
                    }
                    finish()
                } else {
                    val errorMsg = response.body()?.error ?: "Failed to setup PIN"
                    android.util.Log.e("PinSetupActivity", "❌ PIN setup failed: $errorMsg")
                    showError(errorMsg)
                }
            } catch (e: Exception) {
                android.util.Log.e("PinSetupActivity", "❌ PIN setup error: ${e.message}", e)
                showError("Network error: ${e.message}")
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.setupPinButton.isEnabled = true
            }
        }
    }
    
    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }
}

