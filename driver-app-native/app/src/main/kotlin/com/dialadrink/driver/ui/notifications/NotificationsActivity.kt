package com.dialadrink.driver.ui.notifications

import android.os.Bundle
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.ActivityNotificationsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch

class NotificationsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityNotificationsBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNotificationsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupTabs()
        loadNotifications()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Notifications"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun setupTabs() {
        val adapter = NotificationsPagerAdapter(this)
        binding.viewPager.adapter = adapter
        
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Unread Messages"
                1 -> "Read Messages"
                2 -> "Push Notifications"
                else -> ""
            }
        }.attach()
        
        // Update tab indicators when notifications are loaded
        updateTabIndicators(emptyList())
        
        // Update tab indicators when notifications are loaded
        binding.viewPager.registerOnPageChangeCallback(object : androidx.viewpager2.widget.ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                super.onPageSelected(position)
                updateTabIndicators()
            }
        })
    }
    
    private fun loadNotifications() {
        val driverId = SharedPrefs.getDriverId(this)
        
        if (driverId == null) {
            Toast.makeText(this, "Error: Driver not logged in", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        
        lifecycleScope.launch {
            try {
                android.util.Log.d("NotificationsActivity", "Loading notifications for driverId: $driverId")
                val response = ApiClient.getApiService().getNotifications(driverId)
                
                android.util.Log.d("NotificationsActivity", "Response received - isSuccessful: ${response.isSuccessful}, code: ${response.code()}")
                android.util.Log.d("NotificationsActivity", "Response body: ${response.body()}")
                
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body == null) {
                        android.util.Log.e("NotificationsActivity", "Response body is null")
                        Toast.makeText(this@NotificationsActivity, "No data received from server", Toast.LENGTH_LONG).show()
                        return@launch
                    }
                    
                    val notifications = body.data ?: emptyList()
                    android.util.Log.d("NotificationsActivity", "Loaded ${notifications.size} notifications")
                    updateTabIndicators(notifications)
                    
                    // Pass notifications to fragments
                    val unreadFragment = (binding.viewPager.adapter as? NotificationsPagerAdapter)?.getFragment(0) as? UnreadNotificationsFragment
                    val readFragment = (binding.viewPager.adapter as? NotificationsPagerAdapter)?.getFragment(1) as? ReadNotificationsFragment
                    
                    unreadFragment?.setNotifications(notifications.filter { !it.isRead })
                    readFragment?.setNotifications(notifications.filter { it.isRead })
                } else {
                    android.util.Log.e("NotificationsActivity", "Response not successful - code: ${response.code()}, body: ${response.body()}")
                    val errorMessage = try {
                        val errorBody = response.errorBody()?.string()
                        if (!errorBody.isNullOrBlank() && !errorBody.trim().startsWith("<")) {
                            try {
                                val json = org.json.JSONObject(errorBody)
                                json.optString("error", json.optString("message", "Failed to load notifications"))
                            } catch (e: Exception) {
                                if (errorBody.contains("ERR_NGROK") || errorBody.contains("offline")) {
                                    "Connection error: Backend server is offline."
                                } else {
                                    errorBody.take(100)
                                }
                            }
                        } else {
                            "Failed to load notifications (${response.code()})"
                        }
                    } catch (e: Exception) {
                        "Failed to load notifications (${response.code()})"
                    }
                    Toast.makeText(this@NotificationsActivity, errorMessage, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                android.util.Log.e("NotificationsActivity", "Error loading notifications", e)
                android.util.Log.e("NotificationsActivity", "Exception type: ${e.javaClass.name}")
                android.util.Log.e("NotificationsActivity", "Exception message: ${e.message}")
                android.util.Log.e("NotificationsActivity", "Exception cause: ${e.cause}")
                e.printStackTrace()
                
                val errorMsg = when {
                    e is java.net.UnknownHostException -> "Cannot connect to server. Please check your internet connection."
                    e is java.net.SocketTimeoutException -> "Request timed out. Please try again."
                    e is java.io.IOException -> {
                        val msg = e.message ?: "Network error"
                        if (msg.contains("Failed to parse JSON")) {
                            "Server response error. Please try again later."
                        } else {
                            "Network error: $msg"
                        }
                    }
                    e.message?.contains("offline") == true || e.message?.contains("ERR_NGROK") == true -> "Connection error: Backend server is offline."
                    e.message != null -> "Error: ${e.message}"
                    else -> "Unknown error: ${e.javaClass.simpleName}"
                }
                Toast.makeText(this@NotificationsActivity, errorMsg, Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun updateTabIndicators(notifications: List<com.dialadrink.driver.data.model.Notification>? = null) {
        val unreadCount = notifications?.count { !it.isRead } ?: 0
        
        // Update Unread tab - add red dot indicator when there are unread notifications
        val unreadTab = binding.tabLayout.getTabAt(0)
        if (unreadTab != null) {
            if (unreadCount > 0) {
                // Show red dot indicator when there are unread notifications
                val customView = layoutInflater.inflate(R.layout.tab_with_indicator, null)
                val tabText = customView.findViewById<TextView>(R.id.tabText)
                val indicator = customView.findViewById<View>(R.id.indicator)
                
                tabText.text = "Unread Messages"
                indicator.visibility = View.VISIBLE
                
                unreadTab.customView = customView
            } else {
                // No unread notifications - remove custom view and show default text
                unreadTab.customView = null
                unreadTab.text = "Unread Messages"
            }
        }
    }
    
    fun markAsRead(notificationId: Int) {
        val driverId = SharedPrefs.getDriverId(this)
        
        if (driverId == null) {
            android.util.Log.e("NotificationsActivity", "Cannot mark notification as read: Driver not logged in")
            return
        }
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().markNotificationAsRead(driverId, notificationId)
                
                if (response.isSuccessful) {
                    // Reload notifications
                    loadNotifications()
                }
            } catch (e: Exception) {
                android.util.Log.e("NotificationsActivity", "Error marking notification as read: ${e.message}", e)
            }
        }
    }
    
    inner class NotificationsPagerAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
        private val fragments = mutableListOf<Fragment>()
        
        init {
            fragments.add(UnreadNotificationsFragment())
            fragments.add(ReadNotificationsFragment())
            fragments.add(PushNotificationsFragment())
        }
        
        override fun getItemCount(): Int = 3
        
        override fun createFragment(position: Int): Fragment {
            return fragments[position]
        }
        
        fun getFragment(position: Int): Fragment? {
            return if (position < fragments.size) fragments[position] else null
        }
    }
}
