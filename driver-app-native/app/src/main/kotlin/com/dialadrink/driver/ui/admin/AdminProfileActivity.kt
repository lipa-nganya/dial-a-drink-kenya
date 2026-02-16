package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.dialadrink.driver.BuildConfig
import com.dialadrink.driver.databinding.ActivityAdminProfileBinding
import com.dialadrink.driver.utils.SharedPrefs

class AdminProfileActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAdminProfileBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        loadProfileData()
        setupClickListeners()
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
        // Load admin info from SharedPreferences
        val adminUsername = SharedPrefs.getAdminUsername(this) ?: "Admin"
        val adminPhone = SharedPrefs.getAdminPhone(this) ?: "N/A"
        
        binding.adminNameText.text = adminUsername
        binding.adminUsernameText.text = adminUsername
        binding.adminEmailText.text = adminPhone // Using phone as email field since email may not be stored
        
        // Load app info
        loadAppInfo()
    }
    
    private fun loadAppInfo() {
        // Get app version from BuildConfig
        val baseVersion = BuildConfig.VERSION_NAME ?: "1.0.0"
        binding.appVersionText.text = baseVersion
        
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
                    apiUrl.contains("ngrok") || apiUrl.contains("localhost") || apiUrl.contains("127.0.0.1") || apiUrl.contains("192.168") -> "local"
                    apiUrl.contains("gcloud") || apiUrl.contains("cloud") -> "cloud-dev"
                    else -> "development"
                }
            }
        }
    }
    
    private fun setupClickListeners() {
        // Help section
        binding.termsOfUseButton.setOnClickListener {
            openUrl("https://thewolfgang.tech/terms-of-use")
        }
        
        binding.privacyPolicyButton.setOnClickListener {
            openUrl("https://thewolfgang.tech/privacy-policy")
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
}
