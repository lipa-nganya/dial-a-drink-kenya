package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.VerifyPinRequest
import com.dialadrink.driver.databinding.ActivityPinLoginBinding
import com.dialadrink.driver.services.FcmService
import com.dialadrink.driver.ui.dashboard.DashboardActivity
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class PinLoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPinLoginBinding
    private var phone: String = ""
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPinLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: SharedPrefs.getDriverPhone(this) ?: ""
        if (phone.isEmpty()) {
            finish()
            return
        }
        
        binding.phoneText.text = "Phone: $phone"
        setupViews()
        
        // Auto-focus PIN input
        binding.pinEditText.requestFocus()
    }
    
    private fun setupViews() {
        // Format PIN input to show dots/spacing like React Native
        binding.pinEditText.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) {
                // Keep only numbers, max 4 digits
                val text = s.toString().replace(Regex("[^0-9]"), "")
                if (text != s.toString()) {
                    binding.pinEditText.setText(text)
                    binding.pinEditText.setSelection(text.length)
                }
            }
        })
        
        binding.loginButton.setOnClickListener {
            login()
        }
        
        binding.forgotPinText.setOnClickListener {
            handleForgotPin()
        }
    }
    
    private fun handleForgotPin() {
        android.app.AlertDialog.Builder(this)
            .setTitle("Reset PIN")
            .setMessage("You will need to verify your phone number again with OTP to reset your PIN.")
            .setPositiveButton("Reset") { _, _ ->
                // Clear logged-in status
                SharedPrefs.setLoggedIn(this, false)
                
                // Navigate back to phone number screen with resetPin flag
                val intent = Intent(this, PhoneNumberActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                intent.putExtra("resetPin", true)
                startActivity(intent)
                finish()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun login() {
        val pin = binding.pinEditText.text.toString().trim()
        
        if (pin.length != 4) {
            showError("Please enter your 4-digit PIN")
            return
        }
        
        // Clean phone number (remove non-digits) to ensure consistent format
        val cleanedPhone = phone.replace(Regex("[^0-9]"), "")
        android.util.Log.d("PinLoginActivity", "🔐 Verifying PIN for phone: $cleanedPhone")
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.loginButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().verifyPin(
                    cleanedPhone,
                    VerifyPinRequest(pin)
                )
                
                android.util.Log.d("PinLoginActivity", "📡 PIN verification response - Success: ${response.isSuccessful}, Code: ${response.code()}")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    // Mark as logged in
                    SharedPrefs.setLoggedIn(this@PinLoginActivity, true)
                    
                    // Get driver info if not already saved
                    if (SharedPrefs.getDriverId(this@PinLoginActivity) == null) {
                        val driverResponse = ApiClient.getApiService().getDriverByPhone(phone)
                        if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                            val driver = driverResponse.body()!!.data
                            if (driver != null) {
                                SharedPrefs.saveDriverId(this@PinLoginActivity, driver.id)
                                SharedPrefs.saveDriverName(this@PinLoginActivity, driver.name)
                            }
                        }
                    }
                    
                    // Register for push notifications
                    val driverId = SharedPrefs.getDriverId(this@PinLoginActivity)
                    if (driverId != null) {
                        FcmService.registerPushToken(this@PinLoginActivity, driverId)
                    }
                    
                    // Navigate to dashboard
                    val intent = Intent(this@PinLoginActivity, DashboardActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                } else {
                    showError(response.body()?.error ?: "Invalid PIN")
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.loginButton.isEnabled = true
            }
        }
    }
    
    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }
}

