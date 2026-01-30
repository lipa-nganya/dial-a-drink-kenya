package com.dialadrink.driver.ui.orders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.dialadrink.driver.R
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.databinding.ActivityPendingOrdersBinding
import com.dialadrink.driver.databinding.ItemPendingOrderBinding
import com.dialadrink.driver.services.SocketService
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

class PendingOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPendingOrdersBinding
    private val TAG = "PendingOrders"
    private var isLoading = false
    private val orderAssignedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            refreshOrdersFromRepository()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPendingOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupSwipeRefresh()
        setupSocketConnection()
        setupBroadcastReceiver()
        loadOrdersFromRepository()
    }
    
    override fun onResume() {
        super.onResume()
        // Always refresh when resuming to ensure new orders from notifications appear
        // This is especially important when returning from OrderAcceptanceActivity
        if (!isLoading) {
            refreshOrdersFromRepository()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        SocketService.disconnect()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(orderAssignedReceiver)
    }
    
    private fun setupBroadcastReceiver() {
        val filter = IntentFilter("com.dialadrink.driver.ORDER_ASSIGNED")
        LocalBroadcastManager.getInstance(this).registerReceiver(orderAssignedReceiver, filter)
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
            refreshOrdersFromRepository()
        }
    }
    
    private fun setupSocketConnection() {
        val driverId = SharedPrefs.getDriverId(this) ?: return
        
        SocketService.connect(
            driverId = driverId,
            onOrderAssigned = { refreshOrdersFromRepository() },
            onOrderStatusUpdated = { refreshOrdersFromRepository() },
            onPaymentConfirmed = null
        )
    }
    
    private fun loadOrdersFromRepository() {
        if (isLoading) return
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                orders = withTimeoutOrNull(10000) {
                    OrderRepository.getPendingOrders(this@PendingOrdersActivity, forceRefresh = false)
                } ?: emptyList()
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                orders = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    if (orders.isEmpty()) {
                        showEmptyState("No pending orders")
                    } else {
                        displayOrders(orders)
                    }
                }
            }
        }
    }
    
    private fun refreshOrdersFromRepository() {
        if (isLoading) {
            Log.d(TAG, "⚠️ Refresh already in progress, skipping")
            return
        }
        
        isLoading = true
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = true
        
        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                Log.d(TAG, "🔄 Starting refresh of pending orders...")
                orders = withTimeoutOrNull(15000) { // Increased timeout to 15 seconds
                    OrderRepository.getPendingOrders(this@PendingOrdersActivity, forceRefresh = true)
                } ?: run {
                    Log.w(TAG, "⏱️ Timeout while fetching pending orders")
                    emptyList()
                }
                Log.d(TAG, "✅ Fetched ${orders.size} pending orders")
            } catch (e: CancellationException) {
                Log.d(TAG, "🚫 Refresh cancelled")
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error refreshing pending orders", e)
                orders = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    if (orders.isEmpty()) {
                        showEmptyState("No pending orders")
                    } else {
                        displayOrders(orders)
                    }
                }
            }
        }
    }
    
    private fun showEmptyState(message: String) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        removeOrderCards()
        binding.emptyStateText.text = message
        binding.emptyStateText.visibility = View.VISIBLE
    }
    
    private fun displayOrders(orders: List<Order>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        removeOrderCards()
        orders.forEach { order ->
            binding.ordersContainer.addView(createOrderCard(order))
        }
    }
    
    private fun removeOrderCards() {
        // Remove only MaterialCardView instances (order cards), preserve TextView (emptyStateText)
        // We need to iterate backwards to avoid index issues when removing
        for (i in binding.ordersContainer.childCount - 1 downTo 0) {
            val child = binding.ordersContainer.getChildAt(i)
            // Keep TextView (emptyStateText), remove MaterialCardView (order cards)
            if (child is MaterialCardView) {
                binding.ordersContainer.removeViewAt(i)
            }
        }
    }
    
    private fun createOrderCard(order: Order): View {
        val cardBinding = ItemPendingOrderBinding.inflate(LayoutInflater.from(this))
        val card = cardBinding.root as MaterialCardView
        
        // Order number
        cardBinding.orderNumberText.text = "Order #${order.id}"
        
        // Customer name
        cardBinding.customerNameText.text = order.customerName ?: "Customer"
        
        // Location (delivery address)
        cardBinding.locationText.text = order.deliveryAddress ?: "Address not provided"
        
        // Accept button
        cardBinding.acceptButton.setOnClickListener {
            showAcceptConfirmation(order)
        }
        
        // Reject button
        cardBinding.rejectButton.setOnClickListener {
            showRejectConfirmation(order)
        }
        
        return card
    }
    
    private fun showAcceptConfirmation(order: Order) {
        AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Accept Order")
            .setMessage("Do you want to accept Order #${order.id}?")
            .setPositiveButton("Accept") { _, _ ->
                acceptOrder(order)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun showRejectConfirmation(order: Order) {
        AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Reject Order")
            .setMessage("Are you sure you want to reject Order #${order.id}? The order will be unassigned and the admin will be notified.")
            .setPositiveButton("Reject") { _, _ ->
                rejectOrder(order)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun acceptOrder(order: Order) {
        binding.loadingProgress.visibility = View.VISIBLE
        disableAllButtons()
        
        lifecycleScope.launch {
            try {
                val result = withTimeoutOrNull(30000) { // 30 second timeout
                    OrderRepository.respondToOrder(
                        this@PendingOrdersActivity,
                        order.id,
                        accepted = true
                    )
                }
                
                if (result == null) {
                    // Timeout
                    showError("Request timed out. Please try again.")
                } else {
                    val (success, errorMessage) = result
                    if (success) {
                        Toast.makeText(
                            this@PendingOrdersActivity,
                            "Order #${order.id} accepted successfully",
                            Toast.LENGTH_SHORT
                        ).show()
                        
                        // Send broadcast to notify active orders screen to refresh
                        val broadcastIntent = Intent("com.dialadrink.driver.ORDER_ACCEPTED").apply {
                            putExtra("orderId", order.id)
                        }
                        LocalBroadcastManager.getInstance(this@PendingOrdersActivity).sendBroadcast(broadcastIntent)
                        
                        // Navigate to Active Orders screen to show the accepted order
                        val intent = Intent(this@PendingOrdersActivity, ActiveOrdersActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
                            putExtra("orderId", order.id) // Pass order ID so ActiveOrdersActivity can highlight it
                        }
                        startActivity(intent)
                        finish() // Close pending orders screen
                    } else {
                        showError(errorMessage ?: "Failed to accept order. Please try again.")
                    }
                }
            } catch (e: Exception) {
                showError("Error accepting order: ${e.message ?: "Unknown error"}")
            } finally {
                binding.loadingProgress.visibility = View.GONE
                enableAllButtons()
            }
        }
    }
    
    private fun rejectOrder(order: Order) {
        binding.loadingProgress.visibility = View.VISIBLE
        disableAllButtons()
        
        lifecycleScope.launch {
            try {
                val result = withTimeoutOrNull(30000) { // 30 second timeout
                    OrderRepository.respondToOrder(
                        this@PendingOrdersActivity,
                        order.id,
                        accepted = false
                    )
                }
                
                if (result == null) {
                    // Timeout
                    showError("Request timed out. Please try again.")
                } else {
                    val (success, errorMessage) = result
                    if (success) {
                        Toast.makeText(
                            this@PendingOrdersActivity,
                            "Order #${order.id} rejected. Admin will be notified.",
                            Toast.LENGTH_SHORT
                        ).show()
                        refreshOrdersFromRepository()
                    } else {
                        showError(errorMessage ?: "Failed to reject order. Please try again.")
                    }
                }
            } catch (e: Exception) {
                showError("Error rejecting order: ${e.message ?: "Unknown error"}")
            } finally {
                binding.loadingProgress.visibility = View.GONE
                enableAllButtons()
            }
        }
    }
    
    private fun disableAllButtons() {
        for (i in 0 until binding.ordersContainer.childCount) {
            val card = binding.ordersContainer.getChildAt(i) as? MaterialCardView
            card?.findViewById<com.google.android.material.button.MaterialButton>(R.id.acceptButton)?.isEnabled = false
            card?.findViewById<com.google.android.material.button.MaterialButton>(R.id.rejectButton)?.isEnabled = false
        }
    }
    
    private fun enableAllButtons() {
        for (i in 0 until binding.ordersContainer.childCount) {
            val card = binding.ordersContainer.getChildAt(i) as? MaterialCardView
            card?.findViewById<com.google.android.material.button.MaterialButton>(R.id.acceptButton)?.isEnabled = true
            card?.findViewById<com.google.android.material.button.MaterialButton>(R.id.rejectButton)?.isEnabled = true
        }
    }
    
    private fun showError(message: String) {
        AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Error")
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }
}

