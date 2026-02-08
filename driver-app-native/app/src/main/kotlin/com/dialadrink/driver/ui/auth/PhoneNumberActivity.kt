package com.dialadrink.driver.ui.auth

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
    private val phoneCheckHandler = Handler(Looper.getMainLooper())
    private var phoneCheckRunnable: Runnable? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPhoneNumberBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Check if this is a PIN reset request
        isResetPin = intent.getBooleanExtra("resetPin", false)
        
        // Check if admin is already logged in (but allow reset PIN flow)
        if (!isResetPin && SharedPrefs.isAdminLoggedIn(this)) {
            val adminToken = SharedPrefs.getAdminToken(this)
            if (adminToken != null && adminToken.isNotEmpty()) {
                // Admin is logged in, redirect to admin dashboard
                val intent = Intent(this, com.dialadrink.driver.ui.admin.AdminDashboardActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
                finish()
                return
            }
        }
        
        // Check if driver is already logged in (but allow reset PIN flow)
        if (!isResetPin && SharedPrefs.isLoggedIn(this)) {
            val phone = SharedPrefs.getDriverPhone(this)
            if (phone != null) {
                navigateToMain()
                return
            }
        }
        
        setupViews()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Clean up handler to prevent memory leaks
        phoneCheckRunnable?.let { phoneCheckHandler.removeCallbacks(it) }
    }
    
    private fun setupViews() {
        // Initially hide admin button
        binding.adminLoginButton.visibility = View.GONE
        
        binding.phoneEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                binding.errorText.visibility = View.GONE
                // Cancel previous check
                phoneCheckRunnable?.let { phoneCheckHandler.removeCallbacks(it) }
                
                // Debounce phone check (wait 500ms after user stops typing)
                phoneCheckRunnable = Runnable {
                    checkIfAdminExists()
                }
                phoneCheckHandler.postDelayed(phoneCheckRunnable!!, 500)
            }
        })
        
        binding.sendOtpButton.setOnClickListener {
            sendOtp()
        }
        
        binding.adminLoginButton.setOnClickListener {
            val phone = binding.phoneEditText.text.toString().trim()
            if (phone.isEmpty()) {
                showError("Please enter your phone number")
                return@setOnClickListener
            }
            val formattedPhone = formatPhoneNumber(phone)
            SharedPrefs.saveAdminPhone(this, formattedPhone)
            val intent = Intent(this, com.dialadrink.driver.ui.admin.AdminLoginActivity::class.java)
            intent.putExtra("phone", formattedPhone)
            startActivity(intent)
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
                
                // If this is a PIN reset request, always send OTP (skip user existence check)
                if (!isResetPin) {
                    // Check if phone exists as both driver and admin
                    val phoneCheckResponse = ApiClient.getApiService().checkPhoneForUserTypes(formattedPhone)
                    
                    android.util.Log.d("PhoneNumberActivity", "📡 Phone check response - Success: ${phoneCheckResponse.isSuccessful}, Code: ${phoneCheckResponse.code()}")
                    
                    if (phoneCheckResponse.isSuccessful && phoneCheckResponse.body()?.success == true) {
                        val phoneCheck = phoneCheckResponse.body()!!.data
                        val isDriver = phoneCheck?.isDriver ?: false
                        val isAdmin = phoneCheck?.isAdmin ?: false
                        
                        android.util.Log.d("PhoneNumberActivity", "📦 Phone check: isDriver=$isDriver, isAdmin=$isAdmin")
                        
                        if (isDriver && isAdmin) {
                            // Phone exists as both - show user type selection
                            android.util.Log.d("PhoneNumberActivity", "🔀 Phone exists as both driver and admin - showing selection")
                            val intent = Intent(this@PhoneNumberActivity, UserTypeSelectionActivity::class.java)
                            intent.putExtra("phone", formattedPhone)
                            startActivity(intent)
                            return@launch
                        } else if (isDriver) {
                            // Only driver - check if they have PIN
                            val driverResponse = ApiClient.getApiService().getDriverByPhone(formattedPhone)
                            if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                                val driver = driverResponse.body()!!.data
                                if (driver != null) {
                                    android.util.Log.d("PhoneNumberActivity", "✅ Driver found: ${driver.name} (ID: ${driver.id})")
                                    val hasPin = driver.hasPin ?: false
                                    
                                    SharedPrefs.saveDriverPhone(this@PhoneNumberActivity, formattedPhone)
                                    SharedPrefs.saveDriverId(this@PhoneNumberActivity, driver.id)
                                    SharedPrefs.saveDriverName(this@PhoneNumberActivity, driver.name)
                                    
                                    if (hasPin) {
                                        // Driver has PIN - go to PIN login
                                        android.util.Log.d("PhoneNumberActivity", "🔐 Navigating to PIN login")
                                        val intent = Intent(this@PhoneNumberActivity, PinLoginActivity::class.java)
                                        intent.putExtra("phone", formattedPhone)
                                        startActivity(intent)
                                        return@launch
                                    }
                                    // Driver exists but no PIN - continue to OTP flow
                                }
                            }
                        } else if (isAdmin) {
                            // Only admin - check if they have PIN
                            android.util.Log.d("PhoneNumberActivity", "✅ Admin found - checking PIN status")
                            SharedPrefs.saveAdminPhone(this@PhoneNumberActivity, formattedPhone)
                            
                            // Check if admin has PIN from the phone check response
                            val adminInfo = phoneCheck?.admin
                            val adminHasPin = adminInfo?.hasPin ?: false
                            
                            android.util.Log.d("PhoneNumberActivity", "🔐 Admin PIN status: $adminHasPin")
                            
                            if (adminHasPin && !isResetPin) {
                                // Admin has PIN and it's not a reset - go to PIN login
                                android.util.Log.d("PhoneNumberActivity", "🔐 Admin has PIN - navigating to PIN login")
                                val intent = Intent(this@PhoneNumberActivity, com.dialadrink.driver.ui.admin.AdminLoginActivity::class.java)
                                intent.putExtra("phone", formattedPhone)
                                startActivity(intent)
                                return@launch
                            }
                            // Admin has no PIN or reset requested - continue to OTP flow
                        }
                        // Neither driver nor admin - continue to OTP flow
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
                // Determine user type - check if admin phone was saved, otherwise default to driver
                val userType = if (SharedPrefs.getAdminPhone(this@PhoneNumberActivity) == formattedPhone) {
                    "admin"
                } else {
                    "driver"
                }
                
                val sendOtpRequest = SendOtpRequest(
                    phone = formattedPhone,
                    userType = userType,
                    resetPin = if (isResetPin) true else null
                )
                val otpResponse = ApiClient.getApiService().sendOtp(sendOtpRequest)
                
                if (otpResponse.isSuccessful && otpResponse.body()?.success == true) {
                    // Save phone number based on user type
                    if (userType == "admin") {
                        SharedPrefs.saveAdminPhone(this@PhoneNumberActivity, formattedPhone)
                    } else {
                        SharedPrefs.saveDriverPhone(this@PhoneNumberActivity, formattedPhone)
                    }
                    
                    // Navigate to OTP screen
                    val intent = Intent(this@PhoneNumberActivity, OtpVerificationActivity::class.java)
                    intent.putExtra("phone", formattedPhone)
                    intent.putExtra("userType", userType)
                    intent.putExtra("resetPin", isResetPin)
                    startActivity(intent)
                } else {
                    // Check if error indicates PIN is already set (for admin)
                    val errorBody = otpResponse.body()
                    val errorMessage = errorBody?.error ?: "Failed to send OTP"
                    val shouldUsePinLogin = errorBody?.let { 
                        // Check if response indicates PIN login should be used
                        errorMessage.contains("PIN already set", ignoreCase = true) ||
                        errorMessage.contains("use PIN login", ignoreCase = true)
                    } ?: false
                    
                    if (userType == "admin" && shouldUsePinLogin && !isResetPin) {
                        // Admin has PIN - redirect to PIN login
                        android.util.Log.d("PhoneNumberActivity", "🔐 Admin has PIN - redirecting to PIN login")
                        SharedPrefs.saveAdminPhone(this@PhoneNumberActivity, formattedPhone)
                        val intent = Intent(this@PhoneNumberActivity, com.dialadrink.driver.ui.admin.AdminLoginActivity::class.java)
                        intent.putExtra("phone", formattedPhone)
                        startActivity(intent)
                    } else {
                        showError(errorMessage)
                    }
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
    
    private fun checkIfAdminExists() {
        val phone = binding.phoneEditText.text.toString().trim()
        
        if (phone.isEmpty()) {
            binding.adminLoginButton.visibility = View.GONE
            return
        }
        
        val formattedPhone = formatPhoneNumber(phone)
        
        lifecycleScope.launch {
            try {
                // Initialize API client if not already initialized
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PhoneNumberActivity)
                }
                
                val phoneCheckResponse = ApiClient.getApiService().checkPhoneForUserTypes(formattedPhone)
                
                if (phoneCheckResponse.isSuccessful && phoneCheckResponse.body()?.success == true) {
                    val phoneCheck = phoneCheckResponse.body()!!.data
                    val isAdmin = phoneCheck?.isAdmin ?: false
                    
                    // Show admin button only if phone exists as admin
                    binding.adminLoginButton.visibility = if (isAdmin) View.VISIBLE else View.GONE
                } else {
                    binding.adminLoginButton.visibility = View.GONE
                }
            } catch (e: Exception) {
                android.util.Log.e("PhoneNumberActivity", "Error checking admin: ${e.message}")
                binding.adminLoginButton.visibility = View.GONE
            }
        }
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

