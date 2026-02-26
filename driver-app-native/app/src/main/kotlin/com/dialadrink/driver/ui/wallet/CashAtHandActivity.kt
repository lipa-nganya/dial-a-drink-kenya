package com.dialadrink.driver.ui.wallet

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.ActivityCashAtHandBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch

class CashAtHandActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCashAtHandBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCashAtHandBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupSwipeRefresh()
        setupMainTabs()
        loadCashAtHand()
        
        // Handle deep linking from push notifications
        handleDeepLink(intent)
    }
    
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }
    
    override fun onResume() {
        super.onResume()
        // Refresh data when returning to the screen
                refreshTabs()
                loadCashAtHand()
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)

        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeColors(getColor(R.color.accent))
        binding.swipeRefresh.setOnRefreshListener {
            loadCashAtHand()
            refreshTabs()
        }
    }
    
    private fun setupMainTabs() {
        val pagerAdapter = MainPagerAdapter(this)
        binding.mainViewPager.adapter = pagerAdapter
        
        TabLayoutMediator(binding.mainTabLayout, binding.mainViewPager) { tab, position ->
            when (position) {
                0 -> tab.text = "Cash At Hand"
                1 -> tab.text = "Transactions"
            }
        }.attach()
    }
    
    private fun loadCashAtHand() {
        val driverId = SharedPrefs.getDriverId(this) ?: return
        
        binding.loadingProgress.visibility = android.view.View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCashAtHand(driverId)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null) {
                        displayCashAtHandTotal(data.totalCashAtHand ?: 0.0)
                    }
                } else {
                    Toast.makeText(this@CashAtHandActivity, "Failed to load cash at hand", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@CashAtHandActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = android.view.View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }
    
    private fun displayCashAtHandTotal(totalCash: Double) {
        // Update the total in the Cash At Hand form fragment
        try {
            val formFragment = supportFragmentManager.fragments.find { it is CashAtHandFormFragment } as? CashAtHandFormFragment
            formFragment?.updateTotalCash(totalCash)
        } catch (e: Exception) {
            // Fragment not found, ignore
        }
    }
    
    fun refreshTabs() {
        // Refresh all tabs
        val adapter = binding.mainViewPager.adapter as? MainPagerAdapter
        val currentItem = binding.mainViewPager.currentItem
        
        // Refresh Cash At Hand form fragment
        try {
            val formFragment = supportFragmentManager.fragments.find { it is CashAtHandFormFragment } as? CashAtHandFormFragment
            formFragment?.refresh()
        } catch (e: Exception) {
            // Fragment not found, ignore
        }
        
        // Refresh Transactions fragment (which will refresh its sub-tabs)
        try {
            val transactionsFragment = supportFragmentManager.fragments.find { it is TransactionsFragment } as? TransactionsFragment
            transactionsFragment?.refresh()
        } catch (e: Exception) {
            // Fragment not found, ignore
        }
    }
    
    /**
     * Switch to a specific main tab (0 = Cash At Hand, 1 = Transactions)
     * This method is public so fragments can navigate between tabs
     */
    fun switchToMainTab(position: Int) {
        if (::binding.isInitialized) {
            binding.mainViewPager.setCurrentItem(position, true)
        }
    }
    
    private fun handleDeepLink(intent: Intent) {
        val submissionId = intent.getStringExtra("submissionId")
        if (submissionId != null) {
            // Switch to Transactions main tab in CashAtHandActivity (position 1)
            binding.mainViewPager.setCurrentItem(1, true)
            
            // Wait a bit for the fragment to be created, then switch to appropriate sub-tab
            binding.mainViewPager.post {
            val type = intent.getStringExtra("type")
            try {
                val transactionsFragment = supportFragmentManager.fragments.find { it is TransactionsFragment } as? TransactionsFragment
                when (type) {
                    "cash_submission_approved" -> {
                        transactionsFragment?.switchToTransactionsSubTab(2) // Approved tab (Transactions > Approved, position 2)
                        Toast.makeText(this, "Submission approved", Toast.LENGTH_SHORT).show()
                    }
                    "cash_submission_rejected" -> {
                        transactionsFragment?.switchToTransactionsSubTab(3) // Rejected tab (Transactions > Rejected, position 3)
                        Toast.makeText(this, "Submission rejected", Toast.LENGTH_SHORT).show()
                    }
                    else -> {
                        transactionsFragment?.switchToTransactionsSubTab(1) // Pending tab (Transactions > Pending, position 1)
                    }
                }
            } catch (e: Exception) {
                // Fragment not found, ignore
                }
            }
        }
    }
}

class MainPagerAdapter(activity: AppCompatActivity) : androidx.viewpager2.adapter.FragmentStateAdapter(activity) {
    override fun getItemCount(): Int = 2
    
    override fun createFragment(position: Int): androidx.fragment.app.Fragment {
        return when (position) {
            0 -> CashAtHandFormFragment()
            1 -> TransactionsFragment()
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}
