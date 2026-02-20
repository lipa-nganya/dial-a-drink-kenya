package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.Driver
import com.dialadrink.driver.databinding.ActivityLoansBinding
import com.dialadrink.driver.databinding.ItemPendingOrderBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

class LoansActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoansBinding
    private val TAG = "LoansActivity"
    private var isLoading = false
    private val drivers = mutableListOf<Driver>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoansBinding.inflate(layoutInflater)
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
        supportActionBar?.title = "Loans & Penalties"
        
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
            var driversList = emptyList<Driver>()
            try {
                driversList = withTimeoutOrNull(10000) {
                    if (!SharedPrefs.isAdminLoggedIn(this@LoansActivity)) {
                        Toast.makeText(this@LoansActivity, "Please log in as admin", Toast.LENGTH_SHORT).show()
                        emptyList()
                    } else {
                        if (!ApiClient.isInitialized()) {
                            ApiClient.init(this@LoansActivity)
                        }
                        
                        val response = ApiClient.getApiService().getDrivers()
                        
                        if (response.isSuccessful && response.body()?.success == true) {
                            response.body()!!.data ?: emptyList()
                        } else {
                            val errorBody = response.errorBody()?.string()
                            Log.e(TAG, "Failed to load drivers. Code: ${response.code()}, Error: $errorBody")
                            emptyList()
                        }
                    }
                } ?: emptyList()
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "Error loading drivers: ${e.message}", e)
                driversList = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    drivers.clear()
                    drivers.addAll(driversList)
                    displayDrivers()
                }
            }
        }
    }
    
    private fun displayDrivers() {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        removeDriverCards()
        
        if (drivers.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            binding.emptyStateText.text = "No riders found"
        } else {
            binding.emptyStateText.visibility = View.GONE
            drivers.forEach { driver ->
                val card = createDriverCard(driver)
                val layoutParams = android.widget.LinearLayout.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    val marginInDp = 16
                    val scale = resources.displayMetrics.density
                    bottomMargin = (marginInDp * scale + 0.5f).toInt()
                }
                card.layoutParams = layoutParams
                binding.driversContainer.addView(card)
            }
        }
    }
    
    private fun removeDriverCards() {
        for (i in binding.driversContainer.childCount - 1 downTo 0) {
            val child = binding.driversContainer.getChildAt(i)
            if (child is MaterialCardView) {
                binding.driversContainer.removeViewAt(i)
            }
        }
    }
    
    private fun createDriverCard(driver: Driver): View {
        val cardBinding = ItemPendingOrderBinding.inflate(
            LayoutInflater.from(this),
            binding.driversContainer,
            false
        )
        val card = cardBinding.root as MaterialCardView
        
        // Show driver name
        val driverName = driver.name ?: "Driver #${driver.id}"
        cardBinding.orderNumberText.text = driverName
        cardBinding.orderNumberText.gravity = android.view.Gravity.START
        
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
        
        // Make card clickable to view rider details
        card.setOnClickListener {
            val intent = Intent(this, RiderDetailsActivity::class.java)
            intent.putExtra("driverId", driver.id)
            intent.putExtra("driverName", driverName)
            startActivity(intent)
        }
        
        return card
    }
}
