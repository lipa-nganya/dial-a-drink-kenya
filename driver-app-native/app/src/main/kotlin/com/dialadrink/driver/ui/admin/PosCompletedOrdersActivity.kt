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
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.databinding.ActivityCompletedOrdersBinding
import com.dialadrink.driver.databinding.ItemActiveOrderBinding
import com.dialadrink.driver.ui.orders.OrderDetailActivity
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.*

class PosCompletedOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCompletedOrdersBinding
    private val TAG = "PosCompletedOrders"
    private var isLoading = false
    private var currentOrders = emptyList<Order>()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCompletedOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupSwipeRefresh()
        // Hide earnings cards for POS orders
        binding.earningsTodayCard.visibility = View.GONE
        binding.earningsWeekCard.visibility = View.GONE
        binding.earningsMonthCard.visibility = View.GONE
        
        loadOrders()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "POS Completed Orders"

        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeColors(getColor(R.color.accent))
        binding.swipeRefresh.setOnRefreshListener {
            loadOrders()
        }
    }

    private fun loadOrders() {
        if (isLoading) return

        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.swipeRefresh.isRefreshing = true
        binding.emptyStateText.visibility = View.GONE

        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                orders = withTimeoutOrNull(10000) {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(this@PosCompletedOrdersActivity)
                    }
                    
                    // Get all admin orders and filter for completed walk-in orders
                    val response = ApiClient.getApiService().getAdminOrders()
                    
                    if (response.isSuccessful && response.body() != null) {
                        val allOrders = response.body()!!
                        // Filter for completed walk-in orders (deliveryAddress == "In-Store Purchase")
                        allOrders.filter { 
                            it.status == "completed" && 
                            it.deliveryAddress == "In-Store Purchase"
                        }
                    } else {
                        emptyList()
                    }
                } ?: emptyList()
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "Error loading orders", e)
                orders = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false

                    if (orders.isEmpty()) {
                        showEmptyState("No completed POS orders")
                        currentOrders = emptyList()
                    } else {
                        displayOrders(orders)
                        currentOrders = orders
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
        for (i in binding.ordersContainer.childCount - 1 downTo 0) {
            val child = binding.ordersContainer.getChildAt(i)
            if (child is MaterialCardView) {
                binding.ordersContainer.removeViewAt(i)
            }
        }
    }

    private fun createOrderCard(order: Order): View {
        val cardBinding = ItemActiveOrderBinding.inflate(LayoutInflater.from(this))
        val card = cardBinding.root as MaterialCardView

        cardBinding.orderNumberText.text = "Order #${order.id}"

        // Status badge
        val statusColor = getColor(R.color.status_completed)
        val drawable = android.graphics.drawable.GradientDrawable().apply {
            setColor(statusColor)
            cornerRadius = 12f * resources.displayMetrics.density
        }
        cardBinding.statusBadge.background = drawable
        cardBinding.statusText.text = "COMPLETED"

        cardBinding.customerNameText.text = order.customerName ?: "Customer"
        cardBinding.addressText.text = order.deliveryAddress ?: "In-Store Purchase"
        cardBinding.amountText.text = "KES ${(order.totalAmount ?: 0.0).toInt()}"

        // Display payment method and date
        val paymentInfo = buildPaymentInfo(order)
        if (paymentInfo.isNotEmpty()) {
            cardBinding.dateText.text = paymentInfo
        } else if (order.createdAt != null) {
            try {
                val utcTimeZone = TimeZone.getTimeZone("UTC")
                val parser1 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                parser1.timeZone = utcTimeZone
                val date = parser1.parse(order.createdAt)
                if (date != null) {
                    val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
                    val formatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                    formatter.timeZone = nairobiTimeZone
                    cardBinding.dateText.text = formatter.format(date)
                }
            } catch (e: Exception) {
                try {
                    val utcTimeZone = TimeZone.getTimeZone("UTC")
                    val parser2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
                    parser2.timeZone = utcTimeZone
                    val date = parser2.parse(order.createdAt)
                    if (date != null) {
                        val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
                        val formatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                        formatter.timeZone = nairobiTimeZone
                        cardBinding.dateText.text = formatter.format(date)
                    } else {
                        cardBinding.dateText.text = order.createdAt
                    }
                } catch (e2: Exception) {
                    cardBinding.dateText.text = order.createdAt
                }
            }
        }

        // Hide action buttons
        cardBinding.actionButtons.visibility = View.GONE
        cardBinding.navigateButton.visibility = View.GONE
        
        card.setOnClickListener {
            openOrderDetails(order.id)
        }

        return card
    }

    private fun buildPaymentInfo(order: Order): String {
        val paymentMethod = order.paymentMethod?.lowercase() ?: return ""
        
        return when (paymentMethod) {
            "cash" -> "Cash"
            "mobile_money", "mpesa_prompt" -> {
                val transactionCode = order.transactionCode
                val transactionDate = order.transactionDate
                
                if (transactionCode != null && transactionDate != null) {
                    val formattedDate = formatTransactionDate(transactionDate)
                    "M-Pesa\n$transactionCode\n$formattedDate"
                } else if (transactionCode != null) {
                    "M-Pesa\n$transactionCode"
                } else {
                    "M-Pesa"
                }
            }
            else -> ""
        }
    }
    
    private fun formatTransactionDate(dateString: String): String {
        return try {
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd HH:mm:ss",
                "yyyy-MM-dd'T'HH:mm:ss"
            )
            
            val utcTimeZone = TimeZone.getTimeZone("UTC")
            var date: java.util.Date? = null
            for (format in formats) {
                try {
                    val parser = SimpleDateFormat(format, Locale.getDefault())
                    parser.timeZone = utcTimeZone
                    date = parser.parse(dateString)
                    if (date != null) break
                } catch (e: Exception) {
                    // Try next format
                }
            }
            
            if (date != null) {
                val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
                val formatter = SimpleDateFormat("dd/MM/yy HH:mm:ss", Locale.getDefault())
                formatter.timeZone = nairobiTimeZone
                formatter.format(date)
            } else {
                dateString
            }
        } catch (e: Exception) {
            dateString
        }
    }

    private fun openOrderDetails(orderId: Int) {
        val intent = Intent(this, OrderDetailActivity::class.java)
        intent.putExtra("orderId", orderId)
        startActivity(intent)
    }
}
