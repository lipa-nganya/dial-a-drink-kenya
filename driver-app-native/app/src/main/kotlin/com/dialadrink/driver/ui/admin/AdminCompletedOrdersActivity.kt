package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.Driver
import com.dialadrink.driver.databinding.ActivityPendingOrdersBinding
import com.dialadrink.driver.databinding.ItemPendingOrderBinding
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

class AdminCompletedOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPendingOrdersBinding
    private val TAG = "AdminCompletedOrders"
    private var isLoading = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPendingOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupSwipeRefresh()
        loadDrivers()
    }
    
    override fun onResume() {
        super.onResume()
        if (!isLoading) {
            loadDrivers()
        }
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Completed Orders"

        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeColors(getColor(R.color.accent))
        binding.swipeRefresh.setOnRefreshListener {
            loadDrivers()
        }
    }
    
    private fun loadDrivers() {
        if (isLoading) return
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            var drivers = emptyList<Driver>()
            try {
                drivers = withTimeoutOrNull(10000) {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(this@AdminCompletedOrdersActivity)
                    }
                    
                    // Fetch all drivers (riders)
                    val response = ApiClient.getApiService().getDrivers()
                    
                    if (!response.isSuccessful || response.body() == null) {
                        Log.w(TAG, "❌ Failed to fetch drivers: ${response.code()}")
                        emptyList()
                    } else {
                        val apiResponse = response.body()!!
                        if (apiResponse.success != true || apiResponse.data == null) {
                            Log.w(TAG, "❌ API returned error: ${apiResponse.error}")
                            emptyList()
                        } else {
                            apiResponse.data!!
                        }
                    }
                } ?: emptyList()
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error loading drivers", e)
                drivers = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    // Add POS as a special "rider" entry
                    val driversWithPOS = drivers.toMutableList()
                    // Create a special POS driver entry (id = -1 to identify it)
                    val posDriver = Driver(
                        id = -1,
                        name = "POS",
                        phoneNumber = "",
                        hasPin = null,
                        pushToken = null,
                        status = null,
                        cashAtHand = null,
                        creditLimit = null
                    )
                    driversWithPOS.add(0, posDriver) // Add POS at the beginning
                    
                    if (driversWithPOS.isEmpty()) {
                        showEmptyState("No riders found")
                    } else {
                        displayDrivers(driversWithPOS)
                    }
                }
            }
        }
    }
    
    private fun showEmptyState(message: String) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        removeDriverCards()
        binding.emptyStateText.text = message
        binding.emptyStateText.visibility = View.VISIBLE
    }
    
    private fun displayDrivers(drivers: List<Driver>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        removeDriverCards()
        drivers.forEach { driver ->
            val card = createDriverCard(driver)
            binding.ordersContainer.addView(card)
        }
    }
    
    private fun removeDriverCards() {
        for (i in binding.ordersContainer.childCount - 1 downTo 0) {
            val child = binding.ordersContainer.getChildAt(i)
            if (child is MaterialCardView) {
                binding.ordersContainer.removeViewAt(i)
            }
        }
    }
    
    private fun createDriverCard(driver: Driver): View {
        val cardBinding = ItemPendingOrderBinding.inflate(LayoutInflater.from(this), binding.ordersContainer, false)
        val card = cardBinding.root as MaterialCardView
        
        // Only show driver name, centered
        val driverName = driver.name ?: "Driver #${driver.id}"
        cardBinding.orderNumberText.text = driverName
        cardBinding.orderNumberText.gravity = android.view.Gravity.CENTER
        
        // Hide all other elements
        cardBinding.customerNameLabel.visibility = View.GONE
        cardBinding.customerNameText.visibility = View.GONE
        cardBinding.locationLabel.visibility = View.GONE
        cardBinding.locationText.visibility = View.GONE
        cardBinding.driverLabel.visibility = View.GONE
        cardBinding.driverStatusText.visibility = View.GONE
        cardBinding.acceptButton.visibility = View.GONE
        cardBinding.rejectButton.visibility = View.GONE
        cardBinding.actionButtons.visibility = View.GONE
        
        // Make card clickable to view transactions or POS orders
        card.setOnClickListener {
            if (driver.id == -1) {
                // POS - show walk-in orders instead of transactions
                val intent = Intent(this, PosCompletedOrdersActivity::class.java)
                startActivity(intent)
            } else {
                // Regular driver - show transactions
                val intent = Intent(this, DriverTransactionsActivity::class.java)
                intent.putExtra("driverId", driver.id)
                intent.putExtra("driverName", driverName)
                startActivity(intent)
            }
        }
        
        return card
    }
}
