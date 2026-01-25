package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.SendOtpRequest
import com.dialadrink.driver.databinding.ActivityPhoneNumberBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class PhoneNumberActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPhoneNumberBinding
    private var isResetPin: Boolean = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPhoneNumberBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Check if this is a PIN reset request
        isResetPin = intent.getBooleanExtra("resetPin", false)
        
        // Check if already logged in (but allow reset PIN flow)
        if (!isResetPin && SharedPrefs.isLoggedIn(this)) {
            val phone = SharedPrefs.getDriverPhone(this)
            if (phone != null) {
                navigateToMain()
                return
            }
        }
        
        setupViews()
    }
    
    private fun setupViews() {
        binding.phoneEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                binding.errorText.visibility = View.GONE
            }
        })
        
        binding.sendOtpButton.setOnClickListener {
            sendOtp()
        }
    }
    
    private fun sendOtp() {
        val phone = binding.phoneEditText.text.toString().trim()
        
        if (phone.isEmpty()) {
            showError("Please enter your phone number")
            return
        }
        
        // Format phone number (add 254 prefix if needed)
        val formattedPhone = formatPhoneNumber(phone)
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.sendOtpButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                // Initialize API client if not already initialized
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PhoneNumberActivity)
                }
                
                // If this is a PIN reset request, always send OTP (skip driver existence check)
                if (!isResetPin) {
                    // First, check if driver exists in database
                    android.util.Log.d("PhoneNumberActivity", "🔍 Checking if driver exists for phone: $formattedPhone")
                    android.util.Log.d("PhoneNumberActivity", "🌐 API Base URL: ${com.dialadrink.driver.BuildConfig.API_BASE_URL}")
                    
                    val driverResponse = ApiClient.getApiService().getDriverByPhone(formattedPhone)
                    
                    android.util.Log.d("PhoneNumberActivity", "📡 Driver check response - Success: ${driverResponse.isSuccessful}, Code: ${driverResponse.code()}")
                    
                    if (driverResponse.isSuccessful) {
                        val apiResponse = driverResponse.body()
                        val driver = apiResponse?.data
                        android.util.Log.d("PhoneNumberActivity", "📦 Response body: $apiResponse")
                        
                        if (driver != null && apiResponse?.success == true) {
                            // Driver exists - go to PIN login
                            android.util.Log.d("PhoneNumberActivity", "✅ Driver found: ${driver.name} (ID: ${driver.id})")
                            
                            SharedPrefs.saveDriverPhone(this@PhoneNumberActivity, formattedPhone)
                            SharedPrefs.saveDriverId(this@PhoneNumberActivity, driver.id)
                            SharedPrefs.saveDriverName(this@PhoneNumberActivity, driver.name)
                            
                            // Navigate to PIN login
                            val intent = Intent(this@PhoneNumberActivity, PinLoginActivity::class.java)
                            intent.putExtra("phone", formattedPhone)
                            startActivity(intent)
                            return@launch
                        } else {
                            // Driver not found (success: false or data is null) - proceed to OTP flow
                            android.util.Log.d("PhoneNumberActivity", "❌ Driver not found in database (success: ${apiResponse?.success}, data: ${driver != null})")
                            // Continue to OTP flow below
                        }
                    } else {
                        val errorBody = driverResponse.errorBody()?.string()
                        val statusCode = driverResponse.code()
                        android.util.Log.e("PhoneNumberActivity", "❌ Driver check failed: $statusCode - ${driverResponse.message()}")
                        android.util.Log.e("PhoneNumberActivity", "Error body: $errorBody")
                        
                        // If 404, driver doesn't exist - proceed to OTP flow
                        if (statusCode == 404) {
                            android.util.Log.d("PhoneNumberActivity", "📱 Driver not found (404) - proceeding to OTP flow")
                            // Continue to OTP flow below
                        } else if (statusCode >= 500) {
                            // Server error (500+) - show error and don't proceed
                            android.util.Log.e("PhoneNumberActivity", "❌ Server error ($statusCode) - backend may be down or database unavailable")
                            showError("Service temporarily unavailable. Please try again in a moment.")
                            return@launch
                        } else if (errorBody != null && (errorBody.contains("ngrok") || errorBody.contains("ERR_NGROK"))) {
                            // ngrok error page detected - show error
                            android.util.Log.e("PhoneNumberActivity", "❌ ngrok error detected in response")
                            showError("Connection error. Please check your internet connection and try again.")
                            return@launch
                        } else {
                            // Other client errors (400-499 except 404) - proceed to OTP flow
                            android.util.Log.d("PhoneNumberActivity", "⚠️ Client error ($statusCode) - proceeding to OTP flow")
                            // Continue to OTP flow below
                        }
                    }
                } else {
                    android.util.Log.d("PhoneNumberActivity", "🔄 PIN reset requested - skipping driver check, will send OTP")
                    // Get driver info if available for reset flow
                    try {
                        val driverResponse = ApiClient.getApiService().getDriverByPhone(formattedPhone)
                        if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                            val driver = driverResponse.body()!!.data
                            if (driver != null) {
                                SharedPrefs.saveDriverPhone(this@PhoneNumberActivity, formattedPhone)
                                SharedPrefs.saveDriverId(this@PhoneNumberActivity, driver.id)
                                SharedPrefs.saveDriverName(this@PhoneNumberActivity, driver.name)
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.w("PhoneNumberActivity", "Could not fetch driver info for reset: ${e.message}")
                    }
                }
                
                // Send OTP using Advanta SMS
                val logMessage = if (isResetPin) "📱 Sending OTP for PIN reset: $formattedPhone" else "📱 Sending OTP for new driver: $formattedPhone"
                android.util.Log.d("PhoneNumberActivity", logMessage)
                val sendOtpRequest = SendOtpRequest(
                    phone = formattedPhone,
                    userType = "driver",
                    resetPin = if (isResetPin) true else null
                )
                val otpResponse = ApiClient.getApiService().sendOtp(sendOtpRequest)
                
                if (otpResponse.isSuccessful && otpResponse.body()?.success == true) {
                    // Save phone number
                    SharedPrefs.saveDriverPhone(this@PhoneNumberActivity, formattedPhone)
                    
                    // Navigate to OTP screen
                    val intent = Intent(this@PhoneNumberActivity, OtpVerificationActivity::class.java)
                    intent.putExtra("phone", formattedPhone)
                    intent.putExtra("resetPin", isResetPin)
                    startActivity(intent)
                } else {
                    showError(otpResponse.body()?.error ?: "Failed to send OTP")
                }
            } catch (e: Exception) {
                android.util.Log.e("PhoneNumberActivity", "❌ Exception: ${e.message}", e)
                showError("Network error: ${e.message}")
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.sendOtpButton.isEnabled = true
            }
        }
    }
    
    private fun formatPhoneNumber(phone: String): String {
        var cleaned = phone.replace(Regex("[^0-9]"), "")
        
        // If starts with 0, replace with 254
        if (cleaned.startsWith("0")) {
            cleaned = "254" + cleaned.substring(1)
        }
        // If doesn't start with 254, add it
        else if (!cleaned.startsWith("254")) {
            cleaned = "254$cleaned"
        }
        
        return cleaned
    }
    
    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }
    
    private fun navigateToMain() {
        val intent = Intent(this, com.dialadrink.driver.ui.dashboard.DashboardActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}

