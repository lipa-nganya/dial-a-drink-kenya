package com.dialadrink.driver.ui.shopagent

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.ShopAgentLoginRequest
import com.dialadrink.driver.databinding.ActivityAdminLoginBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class ShopAgentLoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAdminLoginBinding
    private var phone: String = ""
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: SharedPrefs.getShopAgentPhone(this) ?: ""
        if (phone.isEmpty()) {
            finish()
            return
        }
        
        binding.titleText.text = "Shop Agent Login"
        binding.phoneText.text = "Phone: $phone"
        setupViews()
        
        // Auto-focus PIN input
        binding.pinEditText.requestFocus()
    }
    
    private fun setupViews() {
        // Format PIN input to show dots/spacing
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
        
        binding.backButton.setOnClickListener {
            finish()
        }
    }
    
    private fun login() {
        val pin = binding.pinEditText.text.toString().trim()
        
        if (pin.length != 4) {
            showError("Please enter your 4-digit PIN")
            return
        }
        
        // Clean phone number (remove non-digits) to ensure consistent format
        val cleanedPhone = phone.replace(Regex("[^0-9]"), "")
        android.util.Log.d("ShopAgentLoginActivity", "🔐 Verifying PIN for shop agent phone: $cleanedPhone")
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.loginButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@ShopAgentLoginActivity)
                }
                
                val response = ApiClient.getApiService().shopAgentLogin(
                    ShopAgentLoginRequest(mobileNumber = cleanedPhone, pin = pin)
                )
                
                android.util.Log.d("ShopAgentLoginActivity", "📡 Shop agent login response - Success: ${response.isSuccessful}, Code: ${response.code()}")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val loginResponse = response.body()!!
                    if (loginResponse.user != null) {
                        // Save shop agent info
                        SharedPrefs.setShopAgentLoggedIn(this@ShopAgentLoginActivity, true)
                        SharedPrefs.saveShopAgentId(this@ShopAgentLoginActivity, loginResponse.user.id)
                        SharedPrefs.saveShopAgentName(this@ShopAgentLoginActivity, loginResponse.user.name ?: "")
                        SharedPrefs.saveShopAgentPhone(this@ShopAgentLoginActivity, cleanedPhone)
                        // Save shop agent token for API authentication
                        if (loginResponse.token != null && loginResponse.token.isNotEmpty()) {
                            SharedPrefs.saveShopAgentToken(this@ShopAgentLoginActivity, loginResponse.token)
                            android.util.Log.d("ShopAgentLoginActivity", "✅ Shop agent token saved successfully")
                            // Reinitialize API client to pick up the new token
                            ApiClient.reinitialize(this@ShopAgentLoginActivity)
                            
                            // Register push token for shop agent
                            com.dialadrink.driver.services.FcmService.registerShopAgentPushToken(
                                this@ShopAgentLoginActivity,
                                loginResponse.user.id
                            )
                        } else {
                            android.util.Log.e("ShopAgentLoginActivity", "❌ Shop agent token is null or empty in login response")
                        }
                        
                        // Navigate to shop agent dashboard
                        val intent = Intent(this@ShopAgentLoginActivity, ShopAgentDashboardActivity::class.java)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        startActivity(intent)
                        finish()
                    } else {
                        showError("Invalid response from server")
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    android.util.Log.e("ShopAgentLoginActivity", "Login failed: $errorBody")
                    val errorMessage = try {
                        // Try to parse as ShopAgentLoginResponse first
                        val shopAgentErrorResponse = ApiClient.gson.fromJson(errorBody, com.dialadrink.driver.data.model.ShopAgentLoginResponse::class.java)
                        shopAgentErrorResponse.error ?: shopAgentErrorResponse.message ?: "Invalid phone number or PIN"
                    } catch (e: Exception) {
                        // Fallback to ApiResponse format
                        try {
                            val errorResponse = ApiClient.gson.fromJson(errorBody, com.dialadrink.driver.data.model.ApiResponse::class.java)
                            errorResponse.error ?: "Invalid phone number or PIN"
                        } catch (e2: Exception) {
                            // Final fallback
                            response.body()?.error ?: response.body()?.message ?: "Invalid phone number or PIN"
                        }
                    }
                    showError(errorMessage)
                }
            } catch (e: Exception) {
                android.util.Log.e("ShopAgentLoginActivity", "Login error", e)
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
