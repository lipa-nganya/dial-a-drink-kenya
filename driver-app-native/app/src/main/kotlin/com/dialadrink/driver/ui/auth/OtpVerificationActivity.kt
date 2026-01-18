package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.VerifyOtpRequest
import com.dialadrink.driver.databinding.ActivityOtpVerificationBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class OtpVerificationActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOtpVerificationBinding
    private var phone: String = ""
    private var isResetPin: Boolean = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOtpVerificationBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        phone = intent.getStringExtra("phone") ?: ""
        isResetPin = intent.getBooleanExtra("resetPin", false)
        
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
                val response = ApiClient.getApiService().verifyOtp(
                    phone,
                    VerifyOtpRequest(otp)
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val hasPin = response.body()?.data?.hasPin ?: false
                    
                    // Get driver info
                    val driverResponse = ApiClient.getApiService().getDriverByPhone(phone)
                    if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                        val driver = driverResponse.body()!!.data
                        if (driver != null) {
                            SharedPrefs.saveDriverId(this@OtpVerificationActivity, driver.id)
                            SharedPrefs.saveDriverName(this@OtpVerificationActivity, driver.name)
                        }
                    }
                    
                    // Navigate based on PIN status
                    // If this is a PIN reset request, always go to PIN setup (even if hasPin is true)
                    if (isResetPin || !hasPin) {
                        // PIN reset or no PIN - go to setup
                        val intent = Intent(this@OtpVerificationActivity, PinSetupActivity::class.java)
                        intent.putExtra("phone", phone)
                        intent.putExtra("resetPin", isResetPin)
                        startActivity(intent)
                    } else {
                        // Has PIN - go to login
                        val intent = Intent(this@OtpVerificationActivity, PinLoginActivity::class.java)
                        intent.putExtra("phone", phone)
                        startActivity(intent)
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

