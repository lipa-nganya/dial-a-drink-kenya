package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.AdminMobileLoginRequest
import com.dialadrink.driver.databinding.ActivityAdminLoginBinding
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class AdminLoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAdminLoginBinding
    private var phone: String = ""
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: SharedPrefs.getAdminPhone(this) ?: ""
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
        android.util.Log.d("AdminLoginActivity", "🔐 Verifying PIN for admin phone: $cleanedPhone")
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.loginButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().adminMobileLogin(
                    AdminMobileLoginRequest(phone = cleanedPhone, pin = pin)
                )
                
                android.util.Log.d("AdminLoginActivity", "📡 Admin login response - Success: ${response.isSuccessful}, Code: ${response.code()}")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val apiResponse = response.body()!!
                    val loginResponse = apiResponse.data
                    if (loginResponse != null && loginResponse.user != null) {
                        // Save admin info
                        SharedPrefs.setAdminLoggedIn(this@AdminLoginActivity, true)
                        SharedPrefs.saveAdminId(this@AdminLoginActivity, loginResponse.user.id)
                        SharedPrefs.saveAdminUsername(this@AdminLoginActivity, loginResponse.user.username)
                        SharedPrefs.saveAdminPhone(this@AdminLoginActivity, cleanedPhone)
                        // Save admin token for API authentication
                        if (loginResponse.token != null && loginResponse.token.isNotEmpty()) {
                            SharedPrefs.saveAdminToken(this@AdminLoginActivity, loginResponse.token)
                            android.util.Log.d("AdminLoginActivity", "✅ Admin token saved successfully")
                        } else {
                            android.util.Log.e("AdminLoginActivity", "❌ Admin token is null or empty in login response")
                        }
                        
                        // Navigate to admin dashboard
                        val intent = Intent(this@AdminLoginActivity, AdminDashboardActivity::class.java)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        startActivity(intent)
                        finish()
                    } else {
                        showError("Invalid response from server")
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    android.util.Log.e("AdminLoginActivity", "Login failed: $errorBody")
                    val errorMessage = try {
                        val errorResponse = ApiClient.gson.fromJson(errorBody, com.dialadrink.driver.data.model.ApiResponse::class.java)
                        errorResponse.error ?: "Invalid phone number or PIN"
                    } catch (e: Exception) {
                        response.body()?.error ?: "Invalid phone number or PIN"
                    }
                    showError(errorMessage)
                }
            } catch (e: Exception) {
                android.util.Log.e("AdminLoginActivity", "Login error", e)
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
