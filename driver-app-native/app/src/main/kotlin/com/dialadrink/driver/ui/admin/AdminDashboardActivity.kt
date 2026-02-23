package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityAdminDashboardBinding
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

class AdminDashboardActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAdminDashboardBinding
    private val TAG = "AdminDashboard"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminDashboardBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupGridButtons()
        displayUserInfo()
        loadOrderCounts()
    }
    
    override fun onResume() {
        super.onResume()
        // Refresh counts when returning to dashboard
        loadOrderCounts()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayShowTitleEnabled(false)
    }
    
    private fun displayUserInfo() {
        val username = SharedPrefs.getAdminUsername(this) ?: "Admin"
        binding.adminNameText.text = "Hi $username"
    }
    
    private fun setupGridButtons() {
        // Row 1: POS, Assign rider
        binding.posCard.setOnClickListener {
            val intent = Intent(this, com.dialadrink.driver.ui.pos.PosProductListActivity::class.java)
            startActivity(intent)
        }
        
        binding.assignRiderCard.setOnClickListener {
            val intent = Intent(this, AssignRiderActivity::class.java)
            startActivity(intent)
        }
        
        // Row 2: Pending, In Progress
        binding.pendingCard.setOnClickListener {
            val intent = Intent(this, com.dialadrink.driver.ui.orders.PendingOrdersActivity::class.java)
            startActivity(intent)
        }
        
        binding.inProgressCard.setOnClickListener {
            val intent = Intent(this, com.dialadrink.driver.ui.orders.InProgressOrdersActivity::class.java)
            startActivity(intent)
        }
        
        // Row 3: Completed Orders, Request Payment
        binding.completeCard.setOnClickListener {
            val intent = Intent(this, AdminCompletedOrdersActivity::class.java)
            startActivity(intent)
        }
        
        binding.requestPaymentCard.setOnClickListener {
            val intent = Intent(this, RequestPaymentActivity::class.java)
            startActivity(intent)
        }
        
        // Row 4: Loans
        binding.loansCard.setOnClickListener {
            val intent = Intent(this, LoansActivity::class.java)
            startActivity(intent)
        }
        
        // Row 5: Switch to Driver App (full width)
        binding.switchToDriverCard.setOnClickListener {
            switchToDriverApp()
        }
    }
    
    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.admin_menu, menu)
        return true
    }
    
    override fun onPrepareOptionsMenu(menu: Menu): Boolean {
        // Style menu items after they're created
        for (i in 0 until menu.size()) {
            val menuItem = menu.getItem(i)
            val actionView = menuItem.actionView
            if (actionView != null) {
                actionView.findViewById<android.widget.TextView>(android.R.id.text1)?.setTextColor(getColor(R.color.text_primary_dark))
            }
        }
        return super.onPrepareOptionsMenu(menu)
    }
    
    override fun onMenuOpened(featureId: Int, menu: Menu): Boolean {
        // Style the popup menu when it opens - use a more reliable approach
        if (featureId == android.view.Window.FEATURE_OPTIONS_PANEL || featureId == 0) {
            // Use post to ensure menu is fully rendered before styling
            binding.root.post {
                try {
                    // Get the menu's popup window using reflection
                    val menuField = menu.javaClass.getDeclaredField("mMenu")
                    menuField.isAccessible = true
                    val menuImpl = menuField.get(menu)
                    
                    // Try different field names for the popup
                    val popupFieldNames = listOf("mPopup", "mActionPopup", "mOverflowPopup")
                    for (fieldName in popupFieldNames) {
                        try {
                            val popupField = menuImpl.javaClass.getDeclaredField(fieldName)
                            popupField.isAccessible = true
                            val popup = popupField.get(menuImpl)
                            
                            // Set background using setBackgroundDrawable or setBackground
                            try {
                                val setBgMethod = popup.javaClass.getMethod("setBackgroundDrawable", android.graphics.drawable.Drawable::class.java)
                                val backgroundDrawable = android.graphics.drawable.ColorDrawable(getColor(R.color.paper_dark))
                                setBgMethod.invoke(popup, backgroundDrawable)
                            } catch (e: NoSuchMethodException) {
                                try {
                                    val setBgMethod = popup.javaClass.getMethod("setBackground", android.graphics.drawable.Drawable::class.java)
                                    val backgroundDrawable = android.graphics.drawable.ColorDrawable(getColor(R.color.paper_dark))
                                    setBgMethod.invoke(popup, backgroundDrawable)
                                } catch (e2: Exception) {
                                    // Try to get the ListView and style it
                                    try {
                                        val listViewField = popup.javaClass.getDeclaredField("mDropDownList")
                                        listViewField.isAccessible = true
                                        val listView = listViewField.get(popup) as? android.widget.ListView
                                        listView?.setBackgroundColor(getColor(R.color.paper_dark))
                                    } catch (e3: Exception) {
                                        Log.d(TAG, "Could not set popup background: ${e3.message}")
                                    }
                                }
                            }
                            
                            // Set text color for menu items by finding ListView children
                            try {
                                val listViewField = popup.javaClass.getDeclaredField("mDropDownList")
                                listViewField.isAccessible = true
                                val listView = listViewField.get(popup) as? android.widget.ListView
                                listView?.setDivider(null)
                                
                                // Style menu item text colors
                                for (i in 0 until (listView?.childCount ?: 0)) {
                                    val child = listView?.getChildAt(i)
                                    child?.findViewById<android.widget.TextView>(android.R.id.text1)?.setTextColor(getColor(R.color.text_primary_dark))
                                }
                            } catch (e: Exception) {
                                // Ignore
                            }
                            break
                        } catch (e: NoSuchFieldException) {
                            continue
                        }
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not style popup menu programmatically: ${e.message}")
                }
            }
        }
        return super.onMenuOpened(featureId, menu)
    }
    
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.menu_profile -> {
                val intent = Intent(this, AdminProfileActivity::class.java)
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
    
    private fun loadOrderCounts() {
        lifecycleScope.launch {
            try {
                // Load pending orders count
                val pendingOrders = OrderRepository.getAdminPendingOrders(this@AdminDashboardActivity, forceRefresh = false)
                binding.pendingCountText.text = pendingOrders.size.toString()
                
                // Load in-progress orders count
                val inProgressOrders = OrderRepository.getAdminInProgressOrders(this@AdminDashboardActivity, forceRefresh = false)
                binding.inProgressCountText.text = inProgressOrders.size.toString()
            } catch (e: Exception) {
                android.util.Log.e("AdminDashboardActivity", "Error loading order counts: ${e.message}", e)
                // Keep default values (0) on error
            }
        }
    }
    
    private fun logout() {
        SharedPrefs.setAdminLoggedIn(this, false)
        SharedPrefs.saveAdminId(this, -1)
        SharedPrefs.saveAdminUsername(this, "")
        SharedPrefs.saveAdminPhone(this, "")
        SharedPrefs.clearAdminToken(this)
        
        val intent = Intent(this, PhoneNumberActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
    
    private fun switchToDriverApp() {
        // Get admin phone number before clearing session
        val adminPhone = SharedPrefs.getAdminPhone(this) ?: ""
        
        if (adminPhone.isEmpty()) {
            // If no phone number, go to phone number entry
            val intent = Intent(this, com.dialadrink.driver.ui.auth.PhoneNumberActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
            return
        }
        
        // Check phone number for available user types and show dialog
        lifecycleScope.launch {
            try {
                // Ensure ApiClient is initialized
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AdminDashboardActivity)
                }
                
                // Check what user types are available for this phone number
                val phoneCheckResponse = ApiClient.getApiService().checkPhoneForUserTypes(adminPhone)
                
                if (phoneCheckResponse.isSuccessful && phoneCheckResponse.body()?.success == true) {
                    val phoneCheck = phoneCheckResponse.body()!!.data
                    val isDriver = phoneCheck?.isDriver ?: false
                    val isAdmin = phoneCheck?.isAdmin ?: false
                    val isShopAgent = phoneCheck?.shopAgent != null
                    
                    // Get PIN status from phone check response
                    val driverInfo = phoneCheck?.driver
                    val adminInfo = phoneCheck?.admin
                    val shopAgentInfo = phoneCheck?.shopAgent
                    val driverHasPin = driverInfo?.hasPin == true
                    val adminHasPin = adminInfo?.hasPin == true
                    val shopAgentHasPin = shopAgentInfo?.hasPin == true
                    
                    // Build list of available user types
                    val availableUsers = mutableListOf<String>()
                    if (isDriver) availableUsers.add("Driver")
                    if (isAdmin) availableUsers.add("Admin")
                    if (isShopAgent) availableUsers.add("Shop Agent")
                    
                    if (availableUsers.isEmpty()) {
                        Toast.makeText(this@AdminDashboardActivity, "No other user types available for this phone number", Toast.LENGTH_SHORT).show()
                        return@launch
                    }
                    
                    // Show dialog with available users
                    showUserSelectionDialog(adminPhone, availableUsers, isDriver, isAdmin, isShopAgent, driverHasPin, adminHasPin, shopAgentHasPin)
                } else {
                    Toast.makeText(this@AdminDashboardActivity, "Failed to check available user types", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking phone for user types: ${e.message}", e)
                Toast.makeText(this@AdminDashboardActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun showUserSelectionDialog(
        phone: String,
        availableUsers: List<String>,
        isDriver: Boolean,
        isAdmin: Boolean,
        isShopAgent: Boolean,
        driverHasPin: Boolean,
        adminHasPin: Boolean,
        shopAgentHasPin: Boolean
    ) {
        MaterialAlertDialogBuilder(this)
            .setTitle("Switch User")
            .setItems(availableUsers.toTypedArray()) { _, which ->
                val selectedUser = availableUsers[which]
                
                // Clear admin session
                SharedPrefs.setAdminLoggedIn(this, false)
                SharedPrefs.saveAdminId(this, -1)
                SharedPrefs.saveAdminUsername(this, "")
                SharedPrefs.saveAdminPhone(this, "")
                SharedPrefs.clearAdminToken(this)
                
                // Navigate directly to the selected user type's login flow
                when (selectedUser) {
                    "Driver" -> {
                        if (driverHasPin) {
                            val intent = Intent(this, com.dialadrink.driver.ui.auth.PinLoginActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.putExtra("userType", "driver")
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                        } else {
                            // Send OTP for driver
                            switchToUserType(phone, "driver")
                        }
                    }
                    "Admin" -> {
                        if (adminHasPin) {
                            val intent = Intent(this, com.dialadrink.driver.ui.admin.AdminLoginActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                        } else {
                            // Send OTP for admin
                            switchToUserType(phone, "admin")
                        }
                    }
                    "Shop Agent" -> {
                        if (shopAgentHasPin) {
                            val intent = Intent(this, com.dialadrink.driver.ui.shopagent.ShopAgentLoginActivity::class.java)
                            intent.putExtra("phone", phone)
                            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                            startActivity(intent)
                            finish()
                        } else {
                            // Send OTP for shop agent
                            switchToUserType(phone, "shop_agent")
                        }
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun switchToUserType(phone: String, userType: String) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AdminDashboardActivity)
                }
                
                val sendOtpRequest = com.dialadrink.driver.data.model.SendOtpRequest(
                    phone = phone,
                    userType = userType
                )
                val response = ApiClient.getApiService().sendOtp(sendOtpRequest)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val intent = Intent(this@AdminDashboardActivity, com.dialadrink.driver.ui.auth.OtpVerificationActivity::class.java)
                    intent.putExtra("phone", phone)
                    intent.putExtra("userType", userType)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                } else {
                    Toast.makeText(this@AdminDashboardActivity, "Failed to send OTP", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending OTP: ${e.message}", e)
                Toast.makeText(this@AdminDashboardActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
