package com.dialadrink.driver.ui.shopagent

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityShopAgentDashboardBinding
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class ShopAgentDashboardActivity : AppCompatActivity() {
    private lateinit var binding: ActivityShopAgentDashboardBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShopAgentDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupGridButtons()
        displayUserInfo()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayShowTitleEnabled(false)
    }
    
    private fun displayUserInfo() {
        val name = SharedPrefs.getShopAgentName(this) ?: "Shop Agent"
        binding.shopAgentNameText.text = "Hi $name"
    }
    
    private fun setupGridButtons() {
        // Inventory Check
        binding.inventoryCheckCard.setOnClickListener {
            val intent = Intent(this, ShopAgentInventoryCheckActivity::class.java)
            startActivity(intent)
        }
        
        // Inventory Check History
        binding.inventoryCheckHistoryCard.setOnClickListener {
            val intent = Intent(this, ShopAgentInventoryCheckHistoryActivity::class.java)
            startActivity(intent)
        }
        
        // Switch User
        binding.switchUserCard.setOnClickListener {
            switchUser()
        }
    }
    
    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.shop_agent_menu, menu)
        return true
    }
    
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.menu_terms -> {
                val intent = Intent(this, com.dialadrink.driver.ui.common.TermsOfUseActivity::class.java)
                intent.putExtra(com.dialadrink.driver.ui.common.TermsOfUseActivity.EXTRA_USER_TYPE, "shop_agent")
                startActivity(intent)
                true
            }
            R.id.menu_privacy -> {
                val intent = Intent(this, com.dialadrink.driver.ui.common.PrivacyPolicyActivity::class.java)
                intent.putExtra(com.dialadrink.driver.ui.common.PrivacyPolicyActivity.EXTRA_USER_TYPE, "shop_agent")
                startActivity(intent)
                true
            }
            R.id.menu_logout -> {
                logout()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
    
    private fun logout() {
        // Clear shop agent session
        SharedPrefs.setShopAgentLoggedIn(this, false)
        SharedPrefs.saveShopAgentId(this, -1)
        SharedPrefs.saveShopAgentName(this, "")
        SharedPrefs.saveShopAgentPhone(this, "")
        SharedPrefs.clearShopAgentToken(this)
        
        // Navigate to phone number entry
        val intent = Intent(this, PhoneNumberActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
    
    private fun switchUser() {
        // Get shop agent phone number before clearing session
        val shopAgentPhone = SharedPrefs.getShopAgentPhone(this) ?: ""
        
        if (shopAgentPhone.isEmpty()) {
            // If no phone number, go to phone number entry
            val intent = Intent(this, PhoneNumberActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
            return
        }
        
        // Check phone number for available user types before clearing session
        lifecycleScope.launch {
            try {
                // Ensure ApiClient is initialized
                if (!com.dialadrink.driver.data.api.ApiClient.isInitialized()) {
                    com.dialadrink.driver.data.api.ApiClient.init(this@ShopAgentDashboardActivity)
                }
                
                // Check what user types are available for this phone number
                val phoneCheckResponse = com.dialadrink.driver.data.api.ApiClient.getApiService().checkPhoneForUserTypes(shopAgentPhone)
                
                if (phoneCheckResponse.isSuccessful && phoneCheckResponse.body()?.success == true) {
                    val phoneCheck = phoneCheckResponse.body()!!.data
                    val isDriver = phoneCheck?.isDriver ?: false
                    val isAdmin = phoneCheck?.isAdmin ?: false
                    val isShopAgent = phoneCheck?.isShopAgent ?: false
                    
                    // Get PIN status from phone check response
                    val driverInfo = phoneCheck?.driver
                    val adminInfo = phoneCheck?.admin
                    val shopAgentInfo = phoneCheck?.shopAgent
                    val driverHasPin = driverInfo?.hasPin == true
                    val adminHasPin = adminInfo?.hasPin == true
                    val shopAgentHasPin = shopAgentInfo?.hasPin == true
                    
                    // Clear shop agent session
                    SharedPrefs.setShopAgentLoggedIn(this@ShopAgentDashboardActivity, false)
                    SharedPrefs.saveShopAgentId(this@ShopAgentDashboardActivity, -1)
                    SharedPrefs.saveShopAgentName(this@ShopAgentDashboardActivity, "")
                    SharedPrefs.saveShopAgentPhone(this@ShopAgentDashboardActivity, "")
                    SharedPrefs.clearShopAgentToken(this@ShopAgentDashboardActivity)
                    
                    // Navigate to UserTypeSelectionActivity with phone number and user type flags
                    val intent = Intent(this@ShopAgentDashboardActivity, com.dialadrink.driver.ui.auth.UserTypeSelectionActivity::class.java)
                    intent.putExtra("phone", shopAgentPhone)
                    intent.putExtra("driverHasPin", driverHasPin)
                    intent.putExtra("adminHasPin", adminHasPin)
                    intent.putExtra("shopAgentHasPin", shopAgentHasPin)
                    intent.putExtra("isDriver", isDriver)
                    intent.putExtra("isAdmin", isAdmin)
                    intent.putExtra("isShopAgent", isShopAgent)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                } else {
                    // If check fails, clear session and go to phone number entry
                    SharedPrefs.setShopAgentLoggedIn(this@ShopAgentDashboardActivity, false)
                    SharedPrefs.saveShopAgentId(this@ShopAgentDashboardActivity, -1)
                    SharedPrefs.saveShopAgentName(this@ShopAgentDashboardActivity, "")
                    SharedPrefs.saveShopAgentPhone(this@ShopAgentDashboardActivity, "")
                    SharedPrefs.clearShopAgentToken(this@ShopAgentDashboardActivity)
                    
                    val intent = Intent(this@ShopAgentDashboardActivity, PhoneNumberActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                }
            } catch (e: Exception) {
                android.util.Log.e("ShopAgentDashboard", "Error checking phone for user types: ${e.message}", e)
                // If check fails, clear session and go to phone number entry
                SharedPrefs.setShopAgentLoggedIn(this@ShopAgentDashboardActivity, false)
                SharedPrefs.saveShopAgentId(this@ShopAgentDashboardActivity, -1)
                SharedPrefs.saveShopAgentName(this@ShopAgentDashboardActivity, "")
                SharedPrefs.saveShopAgentPhone(this@ShopAgentDashboardActivity, "")
                SharedPrefs.clearShopAgentToken(this@ShopAgentDashboardActivity)
                
                val intent = Intent(this@ShopAgentDashboardActivity, PhoneNumberActivity::class.java)
                intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                startActivity(intent)
                finish()
            }
        }
    }
}
