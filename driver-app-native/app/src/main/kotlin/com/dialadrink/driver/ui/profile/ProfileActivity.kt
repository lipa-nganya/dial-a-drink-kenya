package com.dialadrink.driver.ui.profile

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.BuildConfig
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.ActivityProfileBinding
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class ProfileActivity : AppCompatActivity() {
    private lateinit var binding: ActivityProfileBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        loadProfileData()
        setupClickListeners()
    }
    
    override fun onResume() {
        super.onResume()
        // Reload data when screen comes into focus (to update OTA count, etc.)
        loadProfileData()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun loadProfileData() {
        // Load driver info from SharedPreferences
        val driverName = SharedPrefs.getDriverName(this) ?: "Driver"
        val driverPhone = SharedPrefs.getDriverPhone(this) ?: "N/A"
        
        binding.driverNameText.text = driverName
        binding.driverPhoneText.text = driverPhone
        
        // Load driver status from API
        loadDriverStatus(driverPhone)
        
        // Load app info
        loadAppInfo()
    }
    
    private fun loadDriverStatus(phone: String) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@ProfileActivity)
                }
                
                val driverResponse = ApiClient.getApiService().getDriverByPhone(phone)
                if (driverResponse.isSuccessful && driverResponse.body()?.success == true) {
                    val driver = driverResponse.body()!!.data
                    binding.driverStatusText.text = driver?.status ?: "offline"
                } else {
                    binding.driverStatusText.text = "offline"
                }
            } catch (e: Exception) {
                android.util.Log.e("ProfileActivity", "Error loading driver status: ${e.message}", e)
                binding.driverStatusText.text = "offline"
            }
        }
    }
    
    private fun loadAppInfo() {
        // Get app version from BuildConfig
        val baseVersion = BuildConfig.VERSION_NAME ?: "1.0.0"
        
        // Get OTA count from SharedPreferences (if we implement OTA updates later)
        val otaCount = SharedPrefs.getOtaCount(this)
        
        // Format version string
        val versionText = if (otaCount > 0) {
            "$baseVersion (OTA: $otaCount)"
        } else {
            baseVersion
        }
        binding.appVersionText.text = versionText
        
        // Determine branch (for native app, we'll use BuildConfig or SharedPreferences)
        val branch = SharedPrefs.getAppBranch(this) ?: getBranchFromBuildConfig()
        binding.appBranchText.text = branch
        
        // Channel (usually same as branch for native apps)
        val channel = SharedPrefs.getAppChannel(this)
        if (channel != null && channel != branch && channel != "N/A") {
            binding.appChannelLabel.visibility = View.VISIBLE
            binding.appChannelText.visibility = View.VISIBLE
            binding.appChannelText.text = channel
        } else {
            binding.appChannelLabel.visibility = View.GONE
            binding.appChannelText.visibility = View.GONE
        }
    }
    
    private fun getBranchFromBuildConfig(): String {
        // Use BUILD_TYPE from BuildConfig (set in build.gradle based on product flavor)
        val buildType = BuildConfig.BUILD_TYPE ?: ""
        return when (buildType.lowercase()) {
            "local" -> "local"
            "development" -> "development"
            "production" -> "production"
            else -> {
                // Fallback: Check API URL to determine branch
                val apiUrl = BuildConfig.API_BASE_URL ?: ""
                when {
                    apiUrl.contains("ngrok") || apiUrl.contains("localhost") || apiUrl.contains("127.0.0.1") -> "local"
                    apiUrl.contains("gcloud") || apiUrl.contains("cloud") -> "cloud-dev"
                    else -> "development"
                }
            }
        }
    }
    
    private fun setupClickListeners() {
        binding.logoutButton.setOnClickListener {
            showLogoutConfirmation()
        }
        
        // Help section
        binding.termsOfUseButton.setOnClickListener {
            val intent = Intent(this, com.dialadrink.driver.ui.common.TermsOfUseActivity::class.java)
            intent.putExtra(com.dialadrink.driver.ui.common.TermsOfUseActivity.EXTRA_USER_TYPE, "driver")
            startActivity(intent)
        }
        
        binding.privacyPolicyButton.setOnClickListener {
            val intent = Intent(this, com.dialadrink.driver.ui.common.PrivacyPolicyActivity::class.java)
            intent.putExtra(com.dialadrink.driver.ui.common.PrivacyPolicyActivity.EXTRA_USER_TYPE, "driver")
            startActivity(intent)
        }
        
        binding.wolfgangLink.setOnClickListener {
            openUrl("https://thewolfgang.tech/")
        }
    }
    
    private fun openUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        } catch (e: Exception) {
            android.widget.Toast.makeText(this, "Could not open link: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun showLogoutConfirmation() {
        AlertDialog.Builder(this)
            .setTitle("Logout")
            .setMessage("Are you sure you want to logout?")
            .setPositiveButton("Logout") { _, _ ->
                logout()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun logout() {
        // Clear login state
        SharedPrefs.clear(this)
        
        // Navigate to phone number screen
        val intent = Intent(this, PhoneNumberActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}


