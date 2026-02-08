package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.ActivityUserTypeSelectionBinding
import com.dialadrink.driver.ui.admin.AdminDashboardActivity
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class UserTypeSelectionActivity : AppCompatActivity() {
    private lateinit var binding: ActivityUserTypeSelectionBinding
    private var phone: String = ""
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityUserTypeSelectionBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: ""
        if (phone.isEmpty()) {
            finish()
            return
        }
        
        setupViews()
    }
    
    private fun setupViews() {
        binding.phoneText.text = "Phone: $phone"
        
        binding.driverButton.setOnClickListener {
            // User selected driver - proceed with driver login flow
            SharedPrefs.saveDriverPhone(this, phone)
            // Check if driver has PIN
            checkDriverAndProceed()
        }
        
        binding.adminButton.setOnClickListener {
            // User selected admin - proceed with admin login flow
            SharedPrefs.saveAdminPhone(this, phone)
            // Check if admin has PIN first
            checkAdminAndProceed()
        }
    }
    
    private fun checkDriverAndProceed() {
        lifecycleScope.launch {
            try {
                // Ensure ApiClient is initialized
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@UserTypeSelectionActivity)
                }
                
                android.util.Log.d("UserTypeSelectionActivity", "🔍 Checking driver with phone: $phone")
                val driverResponse = ApiClient.getApiService().getDriverByPhone(phone)
                
                android.util.Log.d("UserTypeSelectionActivity", "📡 Driver response - Success: ${driverResponse.isSuccessful}, Code: ${driverResponse.code()}")
                
                if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                    val driver = driverResponse.body()!!.data
                    if (driver != null) {
                        android.util.Log.d("UserTypeSelectionActivity", "✅ Driver found: ${driver.name} (ID: ${driver.id})")
                        SharedPrefs.saveDriverId(this@UserTypeSelectionActivity, driver.id)
                        SharedPrefs.saveDriverName(this@UserTypeSelectionActivity, driver.name)
                        
                        val hasPin = driver.hasPin ?: false
                        android.util.Log.d("UserTypeSelectionActivity", "🔐 Driver PIN status: $hasPin")
                        
                        if (hasPin) {
                            // Driver has PIN - go to PIN login
                            android.util.Log.d("UserTypeSelectionActivity", "🔐 Navigating to PIN login")
                            val intent = Intent(this@UserTypeSelectionActivity, PinLoginActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.putExtra("userType", "driver")
                            startActivity(intent)
                            finish()
                            return@launch
                        } else {
                            // Driver has no PIN - send OTP
                            android.util.Log.d("UserTypeSelectionActivity", "📱 Driver has no PIN - sending OTP")
                            sendOtpForDriver()
                        }
                    } else {
                        // Driver not found - send OTP
                        android.util.Log.w("UserTypeSelectionActivity", "⚠️ Driver data is null - sending OTP")
                        sendOtpForDriver()
                    }
                } else {
                    // Driver check failed - log error and send OTP
                    val errorBody = driverResponse.body()
                    val errorMessage = errorBody?.error ?: "Unknown error"
                    android.util.Log.e("UserTypeSelectionActivity", "❌ Driver check failed: $errorMessage (Code: ${driverResponse.code()})")
                    sendOtpForDriver()
                }
            } catch (e: Exception) {
                android.util.Log.e("UserTypeSelectionActivity", "❌ Exception checking driver: ${e.message}", e)
                sendOtpForDriver()
            }
        }
    }
    
    private fun sendOtpForDriver() {
        lifecycleScope.launch {
            try {
                // Ensure ApiClient is initialized
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@UserTypeSelectionActivity)
                }
                
                android.util.Log.d("UserTypeSelectionActivity", "📱 Sending OTP for driver with phone: $phone")
                val sendOtpRequest = com.dialadrink.driver.data.model.SendOtpRequest(
                    phone = phone,
                    userType = "driver"
                )
                val otpResponse = ApiClient.getApiService().sendOtp(sendOtpRequest)
                
                android.util.Log.d("UserTypeSelectionActivity", "📡 OTP response - Success: ${otpResponse.isSuccessful}, Code: ${otpResponse.code()}")
                
                if (otpResponse.isSuccessful && otpResponse.body()?.success == true) {
                    android.util.Log.d("UserTypeSelectionActivity", "✅ OTP sent successfully")
                    val intent = Intent(this@UserTypeSelectionActivity, OtpVerificationActivity::class.java)
                    intent.putExtra("phone", phone)
                    intent.putExtra("userType", "driver")
                    startActivity(intent)
                    finish()
                } else {
                    // Check if error indicates PIN is already set
                    val errorBody = otpResponse.body()
                    val errorMessage = errorBody?.error ?: "Failed to send OTP"
                    android.util.Log.e("UserTypeSelectionActivity", "❌ OTP send failed: $errorMessage")
                    
                    val shouldUsePinLogin = errorMessage.contains("PIN already set", ignoreCase = true) ||
                            errorMessage.contains("use PIN login", ignoreCase = true)
                    
                    if (shouldUsePinLogin) {
                        // Driver has PIN - redirect to PIN login
                        android.util.Log.d("UserTypeSelectionActivity", "🔐 OTP rejected - driver has PIN, redirecting to PIN login")
                        val intent = Intent(this@UserTypeSelectionActivity, PinLoginActivity::class.java)
                        intent.putExtra("phone", phone)
                        intent.putExtra("userType", "driver")
                        startActivity(intent)
                        finish()
                    } else {
                        android.widget.Toast.makeText(this@UserTypeSelectionActivity, errorMessage, android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("UserTypeSelectionActivity", "❌ Exception sending OTP: ${e.message}", e)
                android.widget.Toast.makeText(this@UserTypeSelectionActivity, "Error: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun checkAdminAndProceed() {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@UserTypeSelectionActivity)
                }
                
                // Check if admin has PIN by checking the phone check response
                val phoneCheckResponse = ApiClient.getApiService().checkPhoneForUserTypes(phone)
                
                if (phoneCheckResponse.isSuccessful && phoneCheckResponse.body()?.success == true) {
                    val phoneCheck = phoneCheckResponse.body()!!.data
                    val adminInfo = phoneCheck?.admin
                    val adminHasPin = adminInfo?.hasPin ?: false
                    
                    android.util.Log.d("UserTypeSelectionActivity", "🔐 Admin PIN status: $adminHasPin")
                    
                    if (adminHasPin) {
                        // Admin has PIN - go to PIN login
                        android.util.Log.d("UserTypeSelectionActivity", "🔐 Admin has PIN - navigating to PIN login")
                        val intent = Intent(this@UserTypeSelectionActivity, com.dialadrink.driver.ui.admin.AdminLoginActivity::class.java)
                        intent.putExtra("phone", phone)
                        startActivity(intent)
                        finish()
                        return@launch
                    }
                }
                
                // Admin has no PIN - send OTP
                sendOtpForAdmin()
            } catch (e: Exception) {
                android.util.Log.e("UserTypeSelectionActivity", "Error checking admin: ${e.message}")
                // If check fails, try OTP flow as fallback
                sendOtpForAdmin()
            }
        }
    }
    
    private fun sendOtpForAdmin() {
        lifecycleScope.launch {
            try {
                val sendOtpRequest = com.dialadrink.driver.data.model.SendOtpRequest(
                    phone = phone,
                    userType = "admin"
                )
                val otpResponse = ApiClient.getApiService().sendOtp(sendOtpRequest)
                if (otpResponse.isSuccessful && otpResponse.body()?.success == true) {
                    val intent = Intent(this@UserTypeSelectionActivity, OtpVerificationActivity::class.java)
                    intent.putExtra("phone", phone)
                    intent.putExtra("userType", "admin")
                    startActivity(intent)
                    finish()
                } else {
                    // Check if error indicates PIN is already set
                    val errorBody = otpResponse.body()?.error
                    if (errorBody?.contains("PIN already set", ignoreCase = true) == true ||
                        errorBody?.contains("use PIN login", ignoreCase = true) == true) {
                        // Admin has PIN - go to PIN login
                        val intent = Intent(this@UserTypeSelectionActivity, PinLoginActivity::class.java)
                        intent.putExtra("phone", phone)
                        intent.putExtra("userType", "admin")
                        startActivity(intent)
                        finish()
                    } else {
                        android.widget.Toast.makeText(this@UserTypeSelectionActivity, "Failed to send OTP", android.widget.Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                android.widget.Toast.makeText(this@UserTypeSelectionActivity, "Error: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }
}
