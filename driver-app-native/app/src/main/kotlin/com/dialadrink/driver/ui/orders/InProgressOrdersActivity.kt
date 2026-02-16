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

class InProgressOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPendingOrdersBinding
    private val TAG = "InProgressOrders"
    private var isLoading = false
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
        }
        loadOrdersFromRepository()
    }
    
    override fun onResume() {
        super.onResume()
        // Always refresh when resuming to ensure latest orders appear
        if (!isLoading) {
            refreshOrdersFromRepository()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        if (!isAdminMode) {
            SocketService.disconnect()
        }
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "In Progress Orders"
        
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
                            OrderRepository.getAdminInProgressOrders(this@InProgressOrdersActivity, forceRefresh = false)
                        } else {
                            OrderRepository.getActiveOrders(this@InProgressOrdersActivity, forceRefresh = false)
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
                            showEmptyState("No in-progress orders")
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
                Log.d(TAG, "🔄 Starting refresh of in-progress orders...")
                orders = withTimeoutOrNull(15000) {
                    if (isAdminMode) {
                        OrderRepository.getAdminInProgressOrders(this@InProgressOrdersActivity, forceRefresh = true)
                    } else {
                        OrderRepository.getActiveOrders(this@InProgressOrdersActivity, forceRefresh = true)
                    }
                } ?: run {
                    Log.w(TAG, "⏱️ Timeout while fetching in-progress orders")
                    emptyList()
                }
                Log.d(TAG, "✅ Fetched ${orders.size} in-progress orders")
            } catch (e: CancellationException) {
                Log.d(TAG, "🚫 Refresh cancelled")
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error refreshing in-progress orders", e)
                orders = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    if (orders.isEmpty()) {
                        showEmptyState("No in-progress orders")
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
        for (i in binding.ordersContainer.childCount - 1 downTo 0) {
            val child = binding.ordersContainer.getChildAt(i)
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
            
            // Show status and location
            val statusText = when (order.status) {
                "confirmed" -> "Confirmed"
                "out_for_delivery" -> "Out for Delivery"
                "delivered" -> "Delivered"
                "pos_order" -> "POS Order"
                else -> {
                    order.status?.replace("_", " ")?.let { 
                        it.replaceFirstChar { char -> char.uppercaseChar() }
                    } ?: "Unknown"
                }
            }
            
            // Build location text with status
            val locationText = buildString {
                append(order.deliveryAddress ?: "Address not provided")
                if (isAdminMode && order.driver != null) {
                    append("\nDriver: ${order.driver?.name ?: "Unknown"}")
                }
                append("\nStatus: $statusText")
            }
            cardBinding.locationText.text = locationText
            
            // Hide accept/reject buttons for in-progress orders (they're already accepted)
            cardBinding.acceptButton.visibility = View.GONE
            cardBinding.rejectButton.visibility = View.GONE
            
            // Calculate and display profit/loss (only in admin mode)
            // Note: profit/loss views don't exist in item_pending_order.xml layout
            // Profit/loss calculation is still available via calculateProfitLoss() if needed
            if (isAdminMode) {
                // Profit/loss display removed - views not in layout
                // Calculation function still available: calculateProfitLoss(order)
            }
            
            // Make card clickable to view details (optional - can navigate to order detail)
            card.setOnClickListener {
                Toast.makeText(this, "Order #${order.id ?: "N/A"} - $statusText", Toast.LENGTH_SHORT).show()
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
