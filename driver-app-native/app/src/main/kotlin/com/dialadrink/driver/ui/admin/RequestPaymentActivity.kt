package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.Driver
import com.dialadrink.driver.data.model.RequestPaymentRequest
import com.dialadrink.driver.databinding.ActivityPendingOrdersBinding
import com.dialadrink.driver.databinding.ItemPendingOrderBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.NumberFormat
import java.util.Locale

class RequestPaymentActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPendingOrdersBinding
    private val TAG = "RequestPayment"
    private var isLoading = false
    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
    
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
        supportActionBar?.title = "Request Payment"
        
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
                        ApiClient.init(this@RequestPaymentActivity)
                    }
                    
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
                    if (drivers.isEmpty()) {
                        showEmptyState("No drivers found")
                    } else {
                        displayDrivers(drivers)
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
        
        val driverName = driver.name ?: "Driver #${driver.id}"
        val cashAtHand = driver.cashAtHand ?: 0.0
        
        // Show driver name
        cardBinding.orderNumberText.text = driverName
        cardBinding.orderNumberText.gravity = android.view.Gravity.START
        
        // Show cash at hand amount
        cardBinding.customerNameLabel.visibility = View.VISIBLE
        cardBinding.customerNameLabel.text = "Cash at Hand:"
        cardBinding.customerNameText.visibility = View.VISIBLE
        cardBinding.customerNameText.text = currencyFormat.format(cashAtHand).replace("KES", "KES")
        cardBinding.customerNameText.setTypeface(null, android.graphics.Typeface.BOLD)
        
        // Hide other elements
        cardBinding.locationLabel.visibility = View.GONE
        cardBinding.locationText.visibility = View.GONE
        cardBinding.driverLabel.visibility = View.GONE
        cardBinding.driverStatusText.visibility = View.GONE
        cardBinding.acceptButton.visibility = View.GONE
        cardBinding.rejectButton.visibility = View.GONE
        
        // Show action buttons with Request Payment button
        cardBinding.actionButtons.visibility = View.VISIBLE
        cardBinding.rejectButton.visibility = View.VISIBLE
        cardBinding.rejectButton.text = "Request Payment"
        cardBinding.rejectButton.setOnClickListener {
            showRequestPaymentDialog(driver, cashAtHand)
        }
        cardBinding.acceptButton.visibility = View.GONE
        
        return card
    }
    
    private fun showRequestPaymentDialog(driver: Driver, cashAtHand: Double) {
        val driverName = driver.name ?: "Driver #${driver.id}"
        
        // Create custom dialog with amount input
        val dialogView = layoutInflater.inflate(R.layout.dialog_request_payment, null)
        val amountEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.amountEditText)
        val mpesaButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.mpesaButton)
        val reminderButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.reminderButton)
        
        // Set default amount to cash at hand
        amountEditText.setText(cashAtHand.toInt().toString())
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Request Payment from $driverName")
            .setView(dialogView)
            .setNegativeButton("Cancel", null)
            .create()
        
        mpesaButton.setOnClickListener {
            val amountText = amountEditText.text?.toString() ?: ""
            val amount = amountText.toDoubleOrNull() ?: 0.0
            
            if (amount <= 0) {
                Toast.makeText(this, "Please enter a valid amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            dialog.dismiss()
            requestPayment(driver, amount, "mpesa")
        }
        
        reminderButton.setOnClickListener {
            val amountText = amountEditText.text?.toString() ?: ""
            val amount = amountText.toDoubleOrNull() ?: 0.0
            
            if (amount <= 0) {
                Toast.makeText(this, "Please enter a valid amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            dialog.dismiss()
            requestPayment(driver, amount, "reminder")
        }
        
        dialog.show()
    }
    
    private fun requestPayment(driver: Driver, amount: Double, type: String) {
        val driverName = driver.name ?: "Driver #${driver.id}"
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@RequestPaymentActivity)
                }
                
                val request = RequestPaymentRequest(
                    amount = amount,
                    type = type
                )
                
                val response = ApiClient.getApiService().requestPaymentFromDriver(driver.id, request)
                
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        val message = if (type == "mpesa") {
                            "M-Pesa prompt sent to $driverName"
                        } else {
                            "Payment reminder sent to $driverName"
                        }
                        Toast.makeText(this@RequestPaymentActivity, message, Toast.LENGTH_SHORT).show()
                    } else {
                        val errorMsg = response.body()?.error ?: "Failed to request payment"
                        Toast.makeText(this@RequestPaymentActivity, errorMsg, Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    Toast.makeText(this@RequestPaymentActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
