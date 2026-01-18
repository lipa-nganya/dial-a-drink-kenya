package com.dialadrink.driver.ui.orders

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
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
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityActiveOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupSwipeRefresh()
        setupSocketConnection()
        
        // Load orders from repository (cached first, then fetch if needed)
        // This is non-blocking - UI renders immediately
        loadOrdersFromRepository()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Disconnect socket when activity is destroyed
        SocketService.disconnect()
        Log.d(TAG, "Socket disconnected on activity destroy")
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
                    val orderId = orderData.optInt("orderId", orderData.optInt("id", -1))
                    val status = orderData.optString("status", "")
                    val paymentStatus = orderData.optString("paymentStatus", "")
                    Log.d(TAG, "📦 Order status updated via socket: Order #$orderId -> $status, Payment: $paymentStatus")
                    
                    // Refresh active orders automatically when order status or payment status updates
                    // This ensures the driver sees the updated status without manual refresh
                    refreshOrdersFromRepository()
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-status-updated event", e)
                    // Still refresh on error to ensure UI is up to date
                    refreshOrdersFromRepository()
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
        if (isLoading) {
            Log.d(TAG, "⏸️ Already loading, skipping loadOrdersFromRepository")
            return
        }
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            try {
                // Add timeout to prevent infinite loading
                val orders = withTimeoutOrNull(20000) { // 20 second timeout
                    OrderRepository.getActiveOrders(this@ActiveOrdersActivity, forceRefresh = false)
                } ?: run {
                    Log.e(TAG, "⏱️ Timeout loading orders from repository")
                    emptyList<Order>()
                }
                
                withContext(Dispatchers.Main) {
                    Log.d(TAG, "📊 Orders loaded: ${orders.size} orders")
                    if (orders.isEmpty()) {
                        Log.d(TAG, "📭 No orders found, showing empty state")
                        showEmptyState("No orders in progress")
                        currentOrders = emptyList()
                    } else {
                        Log.d(TAG, "📦 Orders found, displaying ${orders.size} orders")
                        displayOrders(orders)
                        currentOrders = orders
                    }
                }
            } catch (e: CancellationException) {
                // Activity destroyed, ignore
                Log.d(TAG, "🛑 Loading cancelled")
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error loading orders from repository", e)
                isLoading = false
                withContext(Dispatchers.Main) {
                    showEmptyState("Error loading orders")
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                }
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                }
            }
        }
    }
    
    /**
     * Refresh orders from repository (force fetch)
     */
    private fun refreshOrdersFromRepository() {
        if (isLoading) return
        
        isLoading = true
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = true
        
        val previousOrders = currentOrders.toList()
        
        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                orders = withTimeoutOrNull(10000) {
                    OrderRepository.refreshActiveOrders(this@ActiveOrdersActivity)
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
                    
                    // Check if orders are the same (compare by IDs)
                    val ordersChanged = orders.map { it.id }.toSet() != previousOrders.map { it.id }.toSet()
                    
                    if (orders.isEmpty()) {
                        showEmptyState("No active orders")
                        currentOrders = emptyList()
                    } else {
                        displayOrders(orders)
                        currentOrders = orders
                        
                        // Show toast if orders haven't changed
                        if (!ordersChanged && previousOrders.isNotEmpty()) {
                            Toast.makeText(
                                this@ActiveOrdersActivity,
                                "Active orders are up to date",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }
            }
        }
    }
    
    private fun showEmptyState(message: String) {
        Log.d(TAG, "📭 Showing empty state: $message")
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        removeOrderCards()
        binding.emptyStateText.text = message
        binding.emptyStateText.visibility = View.VISIBLE
        Log.d(TAG, "✅ Empty state set: visible=${binding.emptyStateText.visibility == View.VISIBLE}, text='${binding.emptyStateText.text}', container children: ${binding.ordersContainer.childCount}")
    }
    
    private fun ensureEmptyStateTextExists() {
        // Check if emptyStateText is still in the container
        var found = false
        for (i in 0 until binding.ordersContainer.childCount) {
            if (binding.ordersContainer.getChildAt(i) == binding.emptyStateText) {
                found = true
                break
            }
        }
        
        // If not found, add it back (shouldn't happen, but defensive)
        if (!found) {
            Log.w(TAG, "⚠️ emptyStateText not found in container, re-adding")
            binding.ordersContainer.addView(binding.emptyStateText, 0)
        }
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
        val viewsToRemove = mutableListOf<View>()
        for (i in binding.ordersContainer.childCount - 1 downTo 0) {
            val child = binding.ordersContainer.getChildAt(i)
            // Keep TextView (emptyStateText), remove MaterialCardView (order cards)
            if (child is MaterialCardView) {
                viewsToRemove.add(child)
            }
        }
        // Remove all MaterialCardViews
        viewsToRemove.forEach { binding.ordersContainer.removeView(it) }
        // Ensure emptyStateText is still in the container after removal
        ensureEmptyStateTextExists()
        Log.d(TAG, "🗑️ Removed ${viewsToRemove.size} order cards, remaining children: ${binding.ordersContainer.childCount}")
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
    
    override fun onResume() {
        super.onResume()
        // Refresh orders when activity resumes (e.g., returning from accepting an order)
        // Only refresh if we don't already have orders displayed (check if we have order cards, not emptyStateText)
        val hasOrderCards = (0 until binding.ordersContainer.childCount).any { i ->
            binding.ordersContainer.getChildAt(i) is MaterialCardView
        }
        if (!hasOrderCards && currentOrders.isEmpty()) {
            refreshOrdersFromRepository()
        } else {
            // Just ensure spinner is hidden if we already have orders
            binding.loadingProgress.visibility = View.GONE
        }
    }
}

