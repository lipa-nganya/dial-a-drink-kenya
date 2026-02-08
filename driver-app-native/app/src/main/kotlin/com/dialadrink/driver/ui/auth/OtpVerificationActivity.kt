package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.VerifyOtpRequest
import com.dialadrink.driver.data.model.VerifyOtpRequestWithPhone
import com.dialadrink.driver.databinding.ActivityOtpVerificationBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class OtpVerificationActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOtpVerificationBinding
    private var phone: String = ""
    private var isResetPin: Boolean = false
    private var userType: String = "driver" // "driver" or "admin"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOtpVerificationBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: ""
        isResetPin = intent.getBooleanExtra("resetPin", false)
        userType = intent.getStringExtra("userType") ?: "driver"
        
        if (phone.isEmpty()) {
            finish()
            return
        }
        
        binding.phoneText.text = "Phone: $phone"
        setupViews()
    }
    
    private fun setupViews() {
        binding.verifyOtpButton.setOnClickListener {
            verifyOtp()
        }
    }
    
    private fun verifyOtp() {
        val otp = binding.otpEditText.text.toString().trim()
        
        if (otp.isEmpty()) {
            showError("Please enter the OTP")
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.verifyOtpButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val cleanedPhone = phone.replace(Regex("[^0-9]"), "")
                val response = ApiClient.getApiService().verifyOtp(
                    VerifyOtpRequestWithPhone(
                        phone = cleanedPhone,
                        otpCode = otp
                    )
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val responseData = response.body()!!.data
                    
                    // Check response to determine user type
                    val isAdminResponse = responseData?.isAdmin ?: false
                    val isDriverResponse = responseData?.isDriver ?: false
                    
                    // Use userType from intent, or determine from response
                    val actualUserType = when {
                        userType == "admin" || isAdminResponse -> "admin"
                        userType == "driver" || isDriverResponse -> "driver"
                        else -> userType // fallback to original userType
                    }
                    
                    if (actualUserType == "admin") {
                        // Admin OTP verified
                        val admin = responseData?.admin
                        
                        if (admin != null) {
                            SharedPrefs.saveAdminId(this@OtpVerificationActivity, admin.id)
                            SharedPrefs.saveAdminUsername(this@OtpVerificationActivity, admin.username ?: "")
                        }
                        
                        // Check if admin has PIN from the response
                        // The verify-otp endpoint returns hasPin in the admin object
                        // For admin, if OTP was used, it means either no PIN or PIN reset
                        // So hasPin should be false if we reached OTP verification
                        // But we check the response just in case
                        val hasPin = responseData?.hasPin ?: false
                        
                        android.util.Log.d("OtpVerificationActivity", "🔐 Admin OTP verified - hasPin: $hasPin, isResetPin: $isResetPin")
                        
                        // Navigate based on PIN status
                        // OTP should only be used for PIN setup or PIN reset
                        // If admin has PIN and it's not a reset, they should have used PIN login instead
                        if (isResetPin || !hasPin) {
                            // PIN reset or no PIN - go to setup
                            android.util.Log.d("OtpVerificationActivity", "📝 Navigating to PIN setup (reset: $isResetPin, hasPin: $hasPin)")
                            val intent = Intent(this@OtpVerificationActivity, PinSetupActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.putExtra("userType", "admin")
                            intent.putExtra("resetPin", isResetPin)
                            startActivity(intent)
                        } else {
                            // Has PIN - this shouldn't happen if flow is correct, but go to PIN login anyway
                            android.util.Log.w("OtpVerificationActivity", "⚠️ Admin has PIN but used OTP - redirecting to PIN login")
                            val intent = Intent(this@OtpVerificationActivity, PinLoginActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.putExtra("userType", "admin")
                            startActivity(intent)
                        }
                    } else {
                        // Driver OTP verified
                        val driver = responseData?.driver
                        
                        if (driver != null) {
                            SharedPrefs.saveDriverId(this@OtpVerificationActivity, driver.id)
                            SharedPrefs.saveDriverName(this@OtpVerificationActivity, driver.name ?: "Driver")
                        } else {
                            // Get driver info if not in response
                            val driverResponse = ApiClient.getApiService().getDriverByPhone(phone)
                            if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                                val driverData = driverResponse.body()!!.data
                                if (driverData != null) {
                                    SharedPrefs.saveDriverId(this@OtpVerificationActivity, driverData.id)
                                    SharedPrefs.saveDriverName(this@OtpVerificationActivity, driverData.name)
                                }
                            }
                        }
                        
                        // For drivers, check if they have PIN
                        val hasPin = try {
                            val driverResponse = ApiClient.getApiService().getDriverByPhone(cleanedPhone)
                            if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                                driverResponse.body()!!.data?.hasPin ?: false
                            } else {
                                false
                            }
                        } catch (e: Exception) {
                            false
                        }
                        
                        // Navigate based on PIN status
                        if (isResetPin || !hasPin) {
                            // PIN reset or no PIN - go to setup
                            val intent = Intent(this@OtpVerificationActivity, PinSetupActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.putExtra("userType", "driver")
                            intent.putExtra("resetPin", isResetPin)
                            startActivity(intent)
                        } else {
                            // Has PIN - go to login
                            val intent = Intent(this@OtpVerificationActivity, PinLoginActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.putExtra("userType", "driver")
                            startActivity(intent)
                        }
                    }
                    finish()
                } else {
                    showError(response.body()?.error ?: "Invalid OTP")
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.verifyOtpButton.isEnabled = true
            }
        }
    }
    
    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }
}

