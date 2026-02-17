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
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.utils.SharedPrefs
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
        
        // Clear admin session
        SharedPrefs.setAdminLoggedIn(this, false)
        SharedPrefs.saveAdminId(this, -1)
        SharedPrefs.saveAdminUsername(this, "")
        SharedPrefs.saveAdminPhone(this, "")
        SharedPrefs.clearAdminToken(this)
        
        // Navigate to UserTypeSelectionActivity with phone number
        // This will show the admin/driver selection screen
        // When driver is selected, it will check for PIN and go to PIN login if available
        val intent = Intent(this, com.dialadrink.driver.ui.auth.UserTypeSelectionActivity::class.java)
        intent.putExtra("phone", adminPhone)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}
