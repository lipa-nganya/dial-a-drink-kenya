package com.dialadrink.driver.ui.orders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
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
    
    private var isAdminMode = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPendingOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Check if accessed from admin context
        isAdminMode = SharedPrefs.isAdminLoggedIn(this)
        
        setupToolbar()
        setupSwipeRefresh()
        if (!isAdminMode) {
            setupSocketConnection()
            setupBroadcastReceiver()
        }
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
        if (!isAdminMode) {
            SocketService.disconnect()
            LocalBroadcastManager.getInstance(this).unregisterReceiver(orderAssignedReceiver)
        }
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
                    try {
                        if (isAdminMode) {
                            OrderRepository.getAdminPendingOrders(this@PendingOrdersActivity, forceRefresh = false)
                        } else {
                            OrderRepository.getPendingOrders(this@PendingOrdersActivity, forceRefresh = false)
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error fetching orders: ${e.message}", e)
                        emptyList()
                    }
                } ?: emptyList()
            } catch (e: CancellationException) {
                Log.d(TAG, "Order loading cancelled")
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "Unexpected error loading orders: ${e.message}", e)
                orders = emptyList()
            } finally {
                isLoading = false
                try {
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        if (orders.isEmpty()) {
                            showEmptyState("No pending orders")
                        } else {
                            displayOrders(orders)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error updating UI: ${e.message}", e)
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
                    if (isAdminMode) {
                        OrderRepository.getAdminPendingOrders(this@PendingOrdersActivity, forceRefresh = true)
                    } else {
                        OrderRepository.getPendingOrders(this@PendingOrdersActivity, forceRefresh = true)
                    }
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
            val card = createOrderCard(order)
            binding.ordersContainer.addView(card)
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
        try {
            val cardBinding = ItemPendingOrderBinding.inflate(LayoutInflater.from(this), binding.ordersContainer, false)
            val card = cardBinding.root as MaterialCardView
            
            // Order number
            cardBinding.orderNumberText.text = "Order #${order.id ?: "N/A"}"
            
            // Customer name
            cardBinding.customerNameText.text = order.customerName ?: "Customer"
            
            // Location (delivery address)
            cardBinding.locationText.text = order.deliveryAddress ?: "Address not provided"
            
            // Driver assignment status (only show in admin mode)
            if (isAdminMode) {
                cardBinding.driverLabel.visibility = View.VISIBLE
                cardBinding.driverStatusText.visibility = View.VISIBLE
                
                val driverStatus = when {
                    order.driverId == null -> "No driver assigned"
                    order.driverAccepted == true -> {
                        val driverName = order.driver?.name ?: "Driver #${order.driverId}"
                        "Assigned to: $driverName (Accepted)"
                    }
                    order.driverAccepted == false -> {
                        val driverName = order.driver?.name ?: "Driver #${order.driverId}"
                        "Assigned to: $driverName (Rejected)"
                    }
                    else -> {
                        val driverName = order.driver?.name ?: "Driver #${order.driverId}"
                        "Assigned to: $driverName (Pending acceptance)"
                    }
                }
                cardBinding.driverStatusText.text = driverStatus
            } else {
                cardBinding.driverLabel.visibility = View.GONE
                cardBinding.driverStatusText.visibility = View.GONE
            }
            
            // Calculate and display profit/loss (only in admin mode)
            if (isAdminMode) {
                try {
                    val profitLoss = calculateProfitLoss(order)
                    if (profitLoss != null) {
                        cardBinding.profitLossLabel.visibility = View.VISIBLE
                        cardBinding.profitLossChip.visibility = View.VISIBLE
                        val profitAmount = Math.abs(profitLoss)
                        if (profitLoss >= 0) {
                            cardBinding.profitLossChip.text = "PROFIT +KES ${String.format("%.2f", profitAmount)}"
                            cardBinding.profitLossChip.chipBackgroundColor = ColorStateList.valueOf(Color.parseColor("#4caf50")) // Green
                        } else {
                            cardBinding.profitLossChip.text = "LOSS -KES ${String.format("%.2f", profitAmount)}"
                            cardBinding.profitLossChip.chipBackgroundColor = ColorStateList.valueOf(Color.parseColor("#f44336")) // Red
                        }
                    } else {
                        cardBinding.profitLossLabel.visibility = View.GONE
                        cardBinding.profitLossChip.visibility = View.GONE
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error displaying profit/loss: ${e.message}", e)
                    cardBinding.profitLossLabel.visibility = View.GONE
                    cardBinding.profitLossChip.visibility = View.GONE
                }
            } else {
                cardBinding.profitLossLabel.visibility = View.GONE
                cardBinding.profitLossChip.visibility = View.GONE
            }
            
            // In admin mode, hide accept/reject buttons (admin can't accept/reject orders)
            if (isAdminMode) {
                cardBinding.acceptButton.visibility = View.GONE
                cardBinding.rejectButton.visibility = View.GONE
            } else {
                // Accept button
                cardBinding.acceptButton.setOnClickListener {
                    showAcceptConfirmation(order)
                }
                
                // Reject button
                cardBinding.rejectButton.setOnClickListener {
                    showRejectConfirmation(order)
                }
            }
            
            return card
        } catch (e: Exception) {
            Log.e(TAG, "Error creating order card: ${e.message}", e)
            // Return a simple error card instead of crashing
            val errorCard = MaterialCardView(this)
            errorCard.layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(32, 16, 32, 16)
            }
            val errorText = android.widget.TextView(this)
            errorText.text = "Error loading order #${order.id ?: "N/A"}"
            errorText.setPadding(32, 32, 32, 32)
            errorCard.addView(errorText)
            return errorCard
        }
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
                            putExtra("acceptedOrderId", order.id) // Also pass as acceptedOrderId for compatibility
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
    
    private fun calculateProfitLoss(order: Order): Double? {
        try {
            val totalAmount = order.totalAmount ?: 0.0
            val deliveryFee = order.deliveryFee ?: 0.0
            val orderItems = order.items ?: emptyList()
            
            Log.d(TAG, "💰 Calculating profit/loss for Order #${order.id}: totalAmount=$totalAmount, deliveryFee=$deliveryFee, itemsCount=${orderItems.size}")
            
            if (orderItems.isEmpty()) {
                Log.d(TAG, "⚠️ Order #${order.id} has no items, cannot calculate profit/loss")
                return null
            }
            
            var totalPurchaseCost = 0.0
            var hasPurchasePrice = false
            
            orderItems.forEach { item ->
                try {
                    val drink = item.drink
                    if (drink != null) {
                        Log.d(TAG, "  📦 Item: ${drink.name}, purchasePrice=${drink.purchasePrice}, quantity=${item.quantity}")
                        if (drink.purchasePrice != null) {
                            val purchasePrice = drink.purchasePrice
                            if (purchasePrice >= 0) {
                                val quantity = item.quantity ?: 0
                                totalPurchaseCost += purchasePrice * quantity
                                hasPurchasePrice = true
                                Log.d(TAG, "    ✅ Added to cost: ${purchasePrice * quantity}")
                            }
                        } else {
                            Log.d(TAG, "    ⚠️ No purchase price for ${drink.name}")
                        }
                    } else {
                        Log.d(TAG, "    ⚠️ Item has no drink data")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error calculating purchase cost for item: ${e.message}")
                }
            }
            
            // Only return profit/loss if at least one item has a purchase price
            return if (hasPurchasePrice) {
                val profit = totalAmount - totalPurchaseCost - deliveryFee
                Log.d(TAG, "✅ Order #${order.id} profit/loss: $profit (totalAmount=$totalAmount - purchaseCost=$totalPurchaseCost - deliveryFee=$deliveryFee)")
                profit
            } else {
                Log.d(TAG, "⚠️ Order #${order.id} has no items with purchase price, cannot calculate profit/loss")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error calculating profit/loss: ${e.message}", e)
            return null
        }
    }
}

