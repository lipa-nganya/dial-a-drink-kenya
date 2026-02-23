package com.dialadrink.driver.ui.shopagent

import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.ActivityShopAgentInventoryCheckHistoryBinding
import com.dialadrink.driver.data.model.InventoryCheckHistoryItem
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

class ShopAgentInventoryCheckHistoryActivity : AppCompatActivity() {
    private lateinit var binding: ActivityShopAgentInventoryCheckHistoryBinding
    private val TAG = "InventoryCheckHistory"
    
    private var allChecks: List<InventoryCheckHistoryItem> = emptyList()
    
    private val refreshReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context?, intent: android.content.Intent?) {
            if (intent?.action == "com.dialadrink.driver.INVENTORY_CHECK_REFRESH") {
                Log.d(TAG, "🔄 Received refresh broadcast, fetching history...")
                fetchHistory()
            }
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShopAgentInventoryCheckHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupTabs()
        fetchHistory()
        
        // Register broadcast receiver for refresh
        val filter = android.content.IntentFilter("com.dialadrink.driver.INVENTORY_CHECK_REFRESH")
        androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(this)
            .registerReceiver(refreshReceiver, filter)
        
        // Check if we should open a specific tab
        val tabIndex = intent.getIntExtra("tab", -1)
        if (tabIndex >= 0 && tabIndex < 3) {
            binding.viewPager.post {
                binding.viewPager.setCurrentItem(tabIndex, false)
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Unregister broadcast receiver
        androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(this)
            .unregisterReceiver(refreshReceiver)
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Inventory Check History"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun setupTabs() {
        val adapter = InventoryCheckHistoryPagerAdapter(this)
        binding.viewPager.adapter = adapter
        
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Pending"
                1 -> "Approved"
                2 -> "Rejected"
                else -> ""
            }
        }.attach()
    }
    
    private fun fetchHistory() {
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = android.view.View.VISIBLE
                val response = ApiClient.getApiService().getInventoryCheckHistory()
                
                if (response.isSuccessful) {
                    val apiResponse = response.body()
                    Log.d(TAG, "📦 API Response body: $apiResponse")
                    Log.d(TAG, "📦 API Response success: ${apiResponse?.success}")
                    Log.d(TAG, "📦 API Response data: ${apiResponse?.data}")
                    Log.d(TAG, "📦 API Response data type: ${apiResponse?.data?.javaClass?.simpleName}")
                    
                    // Try to get raw response for debugging
                    try {
                        val rawResponse = response.raw()
                        val source = rawResponse.peekBody(Long.MAX_VALUE)
                        val rawJson = source.string()
                        Log.d(TAG, "📦 Raw JSON response: $rawJson")
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Could not read raw response: ${e.message}")
                    }
                    
                    if (apiResponse?.success == true) {
                        val historyResponse = apiResponse.data
                        Log.d(TAG, "📦 HistoryResponse: $historyResponse")
                        Log.d(TAG, "📦 HistoryResponse success: ${historyResponse?.success}")
                        Log.d(TAG, "📦 HistoryResponse checks: ${historyResponse?.checks}")
                        
                        if (historyResponse != null && historyResponse.checks != null) {
                            allChecks = historyResponse.checks
                            updateFragments()
                            Log.d(TAG, "✅ Fetched ${allChecks.size} inventory check history items")
                        } else {
                            Log.e(TAG, "❌ Checks not found in data field. historyResponse: $historyResponse")
                            Toast.makeText(this@ShopAgentInventoryCheckHistoryActivity, "Failed to load inventory check history", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Log.e(TAG, "❌ Response success is false or null. Response: $apiResponse")
                        Toast.makeText(this@ShopAgentInventoryCheckHistoryActivity, "Failed to load inventory check history", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "❌ Failed to fetch history: ${response.code()} - $errorBody")
                    Toast.makeText(this@ShopAgentInventoryCheckHistoryActivity, "Failed to load inventory check history", Toast.LENGTH_SHORT).show()
                }
            } catch (e: HttpException) {
                Log.e(TAG, "❌ HTTP error: ${e.code()} - ${e.message()}")
                Toast.makeText(this@ShopAgentInventoryCheckHistoryActivity, "Failed to load inventory check history", Toast.LENGTH_SHORT).show()
            } catch (e: IOException) {
                Log.e(TAG, "❌ Network error: ${e.message}")
                Toast.makeText(this@ShopAgentInventoryCheckHistoryActivity, "Network error. Please check your connection.", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e(TAG, "❌ Unexpected error: ${e.message}", e)
                Toast.makeText(this@ShopAgentInventoryCheckHistoryActivity, "An error occurred", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBar.visibility = android.view.View.GONE
            }
        }
    }
    
    private fun updateFragments() {
        val adapter = binding.viewPager.adapter as? InventoryCheckHistoryPagerAdapter
        val pendingFragment = adapter?.getFragment(0) as? PendingChecksFragment
        val approvedFragment = adapter?.getFragment(1) as? ApprovedChecksFragment
        val rejectedFragment = adapter?.getFragment(2) as? RejectedChecksFragment
        
        val pending = allChecks.filter { it.status == "pending" }
        val approved = allChecks.filter { it.status == "approved" }
        val rejected = allChecks.filter { it.status == "recount_requested" }
        
        pendingFragment?.setChecks(pending)
        approvedFragment?.setChecks(approved)
        rejectedFragment?.setChecks(rejected)
    }
    
    fun onRecountSubmitted() {
        // Refresh the history after recount
        fetchHistory()
    }
    
    // ViewPager2 adapter for tabs
    private class InventoryCheckHistoryPagerAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
        private val fragments = mutableListOf<Fragment?>()
        
        init {
            fragments.addAll(listOf(null, null, null))
        }
        
        override fun getItemCount(): Int = 3
        
        override fun createFragment(position: Int): Fragment {
            val fragment = when (position) {
                0 -> PendingChecksFragment()
                1 -> ApprovedChecksFragment()
                2 -> RejectedChecksFragment()
                else -> PendingChecksFragment()
            }
            fragments[position] = fragment
            return fragment
        }
        
        fun getFragment(position: Int): Fragment? {
            return fragments.getOrNull(position)
        }
    }
}
