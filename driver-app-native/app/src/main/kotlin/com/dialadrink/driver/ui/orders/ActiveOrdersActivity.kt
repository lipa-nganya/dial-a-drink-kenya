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
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.dialadrink.driver.R
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.databinding.ActivityActiveOrdersBinding
import com.dialadrink.driver.databinding.ItemActiveOrderBinding
import com.dialadrink.driver.services.SocketService
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject

class ActiveOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityActiveOrdersBinding
    private val TAG = "ActiveOrders"
    private var isLoading = false
    private var currentOrders = emptyList<Order>()
    private val orderAcceptedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            Log.d(TAG, "📨 Received ORDER_ACCEPTED broadcast - refreshing active orders")
            refreshOrdersFromRepository()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityActiveOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupSwipeRefresh()
        setupSocketConnection()
        setupBroadcastReceiver()
        
        // Load orders from repository (cached first, then fetch if needed)
        // This is non-blocking - UI renders immediately
        loadOrdersFromRepository()
    }
    
    override fun onResume() {
        super.onResume()
        // Ensure socket is connected when activity resumes
        val driverId = SharedPrefs.getDriverId(this)
        if (driverId != null && !SocketService.isConnected()) {
            Log.d(TAG, "🔄 Socket not connected, reconnecting...")
            setupSocketConnection()
        }
        // Refresh orders when activity resumes (e.g., returning from accepting an order from pending screen)
        // Always refresh to ensure we have the latest data, especially after accepting an order
        if (!isLoading) {
            refreshOrdersFromRepository()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Don't disconnect socket - other activities might be using it
        // SocketService.disconnect()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(orderAcceptedReceiver)
        Log.d(TAG, "Activity destroyed, socket remains connected for other activities")
    }
    
    private fun setupBroadcastReceiver() {
        val filter = IntentFilter("com.dialadrink.driver.ORDER_ACCEPTED")
        LocalBroadcastManager.getInstance(this).registerReceiver(orderAcceptedReceiver, filter)
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
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Log.w(TAG, "⚠️ No driver ID found, skipping socket connection")
            return
        }
        
        Log.d(TAG, "🔌 Setting up socket connection for driver: $driverId")
        
        SocketService.connect(
            driverId = driverId,
            onOrderAssigned = { orderData ->
                Log.d(TAG, "📦 New order assigned via socket")
                // Refresh from repository (handles caching and deduplication)
                refreshOrdersFromRepository()
            },
            onOrderStatusUpdated = { orderData ->
                try {
                    // Handle both orderId and id fields (backend may send either)
                    val updatedOrderId = orderData.optInt("orderId", orderData.optInt("id", -1))
                    val status = orderData.optString("status", "")
                    val paymentStatus = orderData.optString("paymentStatus", "")
                    Log.d(TAG, "📦 [SOCKET] Order status updated via socket: Order #$updatedOrderId -> $status, Payment: $paymentStatus")
                    
                    // Check if this order is in our current list
                    val orderInList = currentOrders.any { it.id == updatedOrderId }
                    
                    if (orderInList) {
                        // Order exists in list - update it immediately or refresh
                        Log.d(TAG, "✅✅✅ [SOCKET] Order #$updatedOrderId found in active orders list, refreshing...")
                        // Force refresh even if currently loading
                        runOnUiThread {
                            refreshOrdersFromRepository(forceRefresh = true)
                        }
                    } else {
                        // Order not in list - might have been removed or is new
                        // Refresh to sync with server
                        Log.d(TAG, "⚠️ [SOCKET] Order #$updatedOrderId not in current list, refreshing...")
                        runOnUiThread {
                            refreshOrdersFromRepository(forceRefresh = true)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ [SOCKET] Error handling order-status-updated event", e)
                    // Still refresh on error to ensure UI is up to date
                    runOnUiThread {
                        refreshOrdersFromRepository(forceRefresh = true)
                    }
                }
            },
            onPaymentConfirmed = { paymentData ->
                try {
                    val paymentOrderId = paymentData.optInt("orderId", -1)
                    Log.d(TAG, "💰 Payment confirmed via socket: Order #$paymentOrderId")
                    
                    // Refresh active orders automatically when payment is confirmed
                    // This ensures the driver sees the updated payment status without manual refresh
                    refreshOrdersFromRepository()
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling payment-confirmed event", e)
                    // Still refresh on error to ensure UI is up to date
                    refreshOrdersFromRepository()
                }
            }
        )
    }
    
    /**
     * Load orders from repository (cached first, then fetch if needed)
     * This is the ONLY way to get orders - goes through centralized repository
     */
    private fun loadOrdersFromRepository() {
        if (isLoading) return
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                orders = withTimeoutOrNull(2000) { // 2 second timeout
                    OrderRepository.getActiveOrders(this@ActiveOrdersActivity, forceRefresh = false)
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
                        showEmptyState("No orders in progress")
                        currentOrders = emptyList()
                    } else {
                        displayOrders(orders)
                        currentOrders = orders
                    }
                }
            }
        }
    }
    
    /**
     * Refresh orders from repository (force fetch)
     */
    private fun refreshOrdersFromRepository(forceRefresh: Boolean = false) {
        // If already loading and not forcing, skip
        if (isLoading && !forceRefresh) {
            Log.d(TAG, "⚠️ Refresh already in progress, skipping (forceRefresh=$forceRefresh)")
            return
        }
        
        isLoading = true
        binding.loadingProgress.visibility = View.GONE
        // Only show swipe refresh indicator if user initiated (not from socket)
        if (!forceRefresh) {
            binding.swipeRefresh.isRefreshing = true
        }
        
        val previousOrders = currentOrders.toList()
        
        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                Log.d(TAG, "🔄 [REFRESH] Fetching active orders from repository...")
                orders = withTimeoutOrNull(5000) { // Increased timeout to 5 seconds
                    OrderRepository.refreshActiveOrders(this@ActiveOrdersActivity)
                } ?: emptyList()
                Log.d(TAG, "✅ [REFRESH] Fetched ${orders.size} active orders")
            } catch (e: CancellationException) {
                Log.d(TAG, "🚫 [REFRESH] Cancelled")
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "❌ [REFRESH] Error fetching orders", e)
                orders = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    
                    // Check if orders changed (compare by IDs and status)
                    val previousOrderMap = previousOrders.associateBy { it.id }
                    val currentOrderMap = orders.associateBy { it.id }
                    
                    val ordersChanged = orders.map { it.id }.toSet() != previousOrders.map { it.id }.toSet() ||
                        orders.any { order ->
                            val previous = previousOrderMap[order.id]
                            previous != null && (previous.status != order.status || previous.paymentStatus != order.paymentStatus)
                        }
                    
                    if (orders.isEmpty()) {
                        showEmptyState("No active orders")
                        currentOrders = emptyList()
                    } else {
                        // Always update UI if orders changed or if forced refresh
                        if (ordersChanged || forceRefresh) {
                            Log.d(TAG, "✅ [REFRESH] Orders changed or forced refresh, updating UI")
                            displayOrders(orders)
                            currentOrders = orders
                        } else {
                            Log.d(TAG, "ℹ️ [REFRESH] No changes detected, skipping UI update")
                            // Still update currentOrders to keep it in sync
                            currentOrders = orders
                        }
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
    
    private fun displayOrders(orders: List<com.dialadrink.driver.data.model.Order>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        // Remove only order cards, not the empty state text
        removeOrderCards()
        
        orders.forEach { order ->
            val orderCard = createOrderCard(order)
            val layoutParams = android.widget.LinearLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                val marginInDp = 16
                val scale = resources.displayMetrics.density
                bottomMargin = (marginInDp * scale + 0.5f).toInt()
            }
            orderCard.layoutParams = layoutParams
            binding.ordersContainer.addView(orderCard)
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
    
    private fun createOrderCard(order: com.dialadrink.driver.data.model.Order): View {
        val cardBinding = ItemActiveOrderBinding.inflate(LayoutInflater.from(this))
        val card = cardBinding.root as MaterialCardView
        
        // Order number
        cardBinding.orderNumberText.text = "Order #${order.id}"
        
        // Status badge
        val statusColor = getStatusColor(order.status)
        val drawable = android.graphics.drawable.GradientDrawable().apply {
            setColor(statusColor)
            cornerRadius = 12f * resources.displayMetrics.density
        }
        cardBinding.statusBadge.background = drawable
        cardBinding.statusText.text = order.status.replace("_", " ").uppercase()
        
        // Customer name
        cardBinding.customerNameText.text = order.customerName
        
        // Delivery address
        cardBinding.addressText.text = order.deliveryAddress
        
        // Hide amount and date (not requested)
        cardBinding.amountText.visibility = View.GONE
        cardBinding.dateText.visibility = View.GONE
        cardBinding.footerDivider.visibility = View.GONE
        cardBinding.footerLayout.visibility = View.GONE
        
        // Hide action buttons (not requested)
        cardBinding.actionButtons.visibility = View.GONE
        
        // Card click - navigate to order details
        card.setOnClickListener {
            openOrderDetails(order.id)
        }
        
        return card
    }
    
    private fun getStatusColor(status: String): Int {
        return when (status) {
            "pending" -> getColor(R.color.status_pending)
            "confirmed" -> getColor(R.color.status_confirmed)
            "preparing" -> getColor(R.color.status_preparing)
            "out_for_delivery" -> getColor(R.color.status_out_for_delivery)
            "delivered" -> getColor(R.color.status_delivered)
            "completed" -> getColor(R.color.status_completed)
            "cancelled" -> getColor(R.color.status_cancelled)
            else -> getColor(R.color.status_default)
        }
    }
    
    private fun openOrderDetails(orderId: Int) {
        val intent = Intent(this, OrderDetailActivity::class.java)
        intent.putExtra("orderId", orderId)
        startActivity(intent)
    }
}

