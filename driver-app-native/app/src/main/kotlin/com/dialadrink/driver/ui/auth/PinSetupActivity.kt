package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.SetupPinRequest
import com.dialadrink.driver.data.model.ShopAgentSetPinRequest
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
                
                val response = when (userType) {
                    "admin" -> {
                        // Admin PIN setup
                        ApiClient.getApiService().setupAdminPin(
                            cleanedPhone,
                            SetupPinRequest(pin)
                        )
                    }
                    "shop_agent" -> {
                        // Shop agent PIN setup - need OTP code from previous verification
                        // Get OTP from intent if available
                        val otpCode = intent.getStringExtra("otpCode")
                        android.util.Log.d("PinSetupActivity", "🔐 Shop agent PIN setup - phone: $cleanedPhone, OTP provided: ${otpCode != null}, OTP: $otpCode")
                        android.util.Log.d("PinSetupActivity", "🔐 API Base URL: ${com.dialadrink.driver.BuildConfig.API_BASE_URL}")
                        android.util.Log.d("PinSetupActivity", "🔐 Full endpoint will be: ${com.dialadrink.driver.BuildConfig.API_BASE_URL}/api/shop-agents/set-pin")
                        ApiClient.getApiService().shopAgentSetPin(
                            ShopAgentSetPinRequest(
                                mobileNumber = cleanedPhone,
                                pin = pin,
                                otpCode = otpCode
                            )
                        )
                    }
                    else -> {
                        // Driver PIN setup
                        ApiClient.getApiService().setupPin(
                            cleanedPhone,
                            SetupPinRequest(pin)
                        )
                    }
                }
                
                android.util.Log.d("PinSetupActivity", "📡 PIN setup response - Success: ${response.isSuccessful}, Code: ${response.code()}")
                
                // Handle response based on user type since they return different response types
                when (userType) {
                    "admin" -> {
                        val adminResponse = response as? retrofit2.Response<com.dialadrink.driver.data.model.ApiResponse<com.dialadrink.driver.data.model.SetupPinResponse>>
                        if (adminResponse?.isSuccessful == true && adminResponse.body()?.success == true) {
                            android.util.Log.d("PinSetupActivity", "✅ PIN setup successful for admin")
                            // Mark admin as logged in
                            SharedPrefs.setAdminLoggedIn(this@PinSetupActivity, true)
                            
                            // Navigate to admin dashboard
                            val intent = Intent(this@PinSetupActivity, com.dialadrink.driver.ui.admin.AdminDashboardActivity::class.java)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                        } else {
                            val errorMsg = adminResponse?.body()?.error ?: "Failed to setup PIN"
                            android.util.Log.e("PinSetupActivity", "❌ PIN setup failed: $errorMsg")
                            showError(errorMsg)
                        }
                    }
                    "shop_agent" -> {
                        val shopAgentResponse = response as? retrofit2.Response<com.dialadrink.driver.data.model.ShopAgentSetPinResponse>
                        if (shopAgentResponse?.isSuccessful == true && shopAgentResponse.body()?.success == true) {
                            android.util.Log.d("PinSetupActivity", "✅ PIN setup successful for shop agent")
                            // Mark shop agent as logged in
                            val setPinResponse = shopAgentResponse.body()
                            if (setPinResponse != null && setPinResponse.user != null) {
                                SharedPrefs.setShopAgentLoggedIn(this@PinSetupActivity, true)
                                SharedPrefs.saveShopAgentId(this@PinSetupActivity, setPinResponse.user.id)
                                SharedPrefs.saveShopAgentName(this@PinSetupActivity, setPinResponse.user.name ?: "")
                                SharedPrefs.saveShopAgentPhone(this@PinSetupActivity, cleanedPhone)
                                if (setPinResponse.token != null && setPinResponse.token.isNotEmpty()) {
                                    SharedPrefs.saveShopAgentToken(this@PinSetupActivity, setPinResponse.token)
                                    // Reinitialize API client to pick up the new token
                                    ApiClient.reinitialize(this@PinSetupActivity)
                                }
                            }
                            
                            // Navigate to shop agent dashboard
                            val intent = Intent(this@PinSetupActivity, com.dialadrink.driver.ui.shopagent.ShopAgentDashboardActivity::class.java)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                        } else {
                            val errorBody = shopAgentResponse?.errorBody()?.string()
                            android.util.Log.e("PinSetupActivity", "❌ Shop agent PIN setup failed - Code: ${shopAgentResponse?.code()}, Body: $errorBody")
                            val errorMsg = try {
                                if (errorBody != null) {
                                    val errorResponse = ApiClient.gson.fromJson(errorBody, com.dialadrink.driver.data.model.ShopAgentSetPinResponse::class.java)
                                    errorResponse.error ?: errorResponse.message ?: "Failed to setup PIN"
                                } else {
                                    shopAgentResponse?.body()?.error ?: shopAgentResponse?.body()?.message ?: "Failed to setup PIN"
                                }
                            } catch (e: Exception) {
                                "Failed to setup PIN (${shopAgentResponse?.code()})"
                            }
                            android.util.Log.e("PinSetupActivity", "❌ PIN setup failed: $errorMsg")
                            showError(errorMsg)
                        }
                    }
                    else -> {
                        // Driver PIN setup
                        val driverResponse = response as? retrofit2.Response<com.dialadrink.driver.data.model.ApiResponse<com.dialadrink.driver.data.model.SetupPinResponse>>
                        if (driverResponse?.isSuccessful == true && driverResponse.body()?.success == true) {
                            android.util.Log.d("PinSetupActivity", "✅ PIN setup successful for driver")
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
                            finish()
                        } else {
                            val errorMsg = driverResponse?.body()?.error ?: "Failed to setup PIN"
                            android.util.Log.e("PinSetupActivity", "❌ PIN setup failed: $errorMsg")
                            showError(errorMsg)
                        }
                    }
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

