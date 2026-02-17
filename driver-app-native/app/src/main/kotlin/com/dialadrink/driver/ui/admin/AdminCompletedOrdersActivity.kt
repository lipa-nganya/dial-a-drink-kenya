package com.dialadrink.driver.ui.admin

import android.app.DatePickerDialog
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.databinding.ActivityCompletedOrdersBinding
import com.dialadrink.driver.databinding.ItemActiveOrderBinding
import com.dialadrink.driver.ui.orders.OrderDetailActivity
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.*

class AdminCompletedOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCompletedOrdersBinding
    private val TAG = "AdminCompletedOrders"
    private var isLoading = false
    private var currentOrders = emptyList<Order>()
    private var fromDate: Date? = null
    private var toDate: Date? = null
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCompletedOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupSwipeRefresh()
        setupDatePickers()
        // Hide earnings cards for admin (not relevant)
        binding.earningsTodayCard.visibility = View.GONE
        binding.earningsWeekCard.visibility = View.GONE
        binding.earningsMonthCard.visibility = View.GONE
        
        // Set default date range to last 30 days
        val calendar = Calendar.getInstance()
        toDate = calendar.time
        calendar.add(Calendar.DAY_OF_YEAR, -30)
        fromDate = calendar.time
        binding.fromDateButton.text = dateFormat.format(fromDate!!)
        binding.toDateButton.text = dateFormat.format(toDate!!)
        
        loadOrders()
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
            loadOrders()
        }
    }

    private fun setupDatePickers() {
        binding.fromDateButton.text = "From Date"
        binding.toDateButton.text = "To Date"
        
        binding.fromDateButton.setOnClickListener {
            showDatePicker(true)
        }

        binding.toDateButton.setOnClickListener {
            showDatePicker(false)
        }

        binding.clearDatesButton.setOnClickListener {
            fromDate = null
            toDate = null
            binding.fromDateButton.text = "From Date"
            binding.toDateButton.text = "To Date"
            loadOrders()
        }
    }

    private fun showDatePicker(isFromDate: Boolean) {
        val calendar = Calendar.getInstance()
        if (isFromDate && fromDate != null) {
            calendar.time = fromDate!!
        } else if (!isFromDate && toDate != null) {
            calendar.time = toDate!!
        }

        DatePickerDialog(
            this,
            R.style.Theme_DialADrinkDriver_DatePickerDialog,
            { _, year, month, dayOfMonth ->
                val selectedDate = Calendar.getInstance().apply {
                    set(year, month, dayOfMonth)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }.time

                if (isFromDate) {
                    fromDate = selectedDate
                    binding.fromDateButton.text = dateFormat.format(selectedDate)
                } else {
                    toDate = selectedDate
                    binding.toDateButton.text = dateFormat.format(selectedDate)
                }

                loadOrders()
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun loadOrders() {
        if (isLoading) return

        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.swipeRefresh.isRefreshing = true
        binding.emptyStateText.visibility = View.GONE

        val previousOrders = currentOrders.toList()

        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                orders = withTimeoutOrNull(10000) {
                    OrderRepository.getAdminCompletedOrders(
                        this@AdminCompletedOrdersActivity,
                        fromDate = fromDate,
                        toDate = toDate
                    )
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

                    val ordersChanged = orders.map { it.id }.toSet() != previousOrders.map { it.id }.toSet()

                    // Update stats
                    updateStats(orders)
                    
                    if (orders.isEmpty()) {
                        showEmptyState("No completed orders")
                        currentOrders = emptyList()
                    } else {
                        displayOrders(orders)
                        currentOrders = orders

                        if (!ordersChanged && previousOrders.isNotEmpty()) {
                            Toast.makeText(
                                this@AdminCompletedOrdersActivity,
                                "Completed orders are up to date",
                                Toast.LENGTH_SHORT
                            ).show()
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
        val statusColor = getStatusColor(order.status)
        val drawable = android.graphics.drawable.GradientDrawable().apply {
            setColor(statusColor)
            cornerRadius = 12f * resources.displayMetrics.density
        }
        cardBinding.statusBadge.background = drawable
        cardBinding.statusText.text = order.status.replace("_", " ").uppercase()

        cardBinding.customerNameText.text = order.customerName ?: "Customer"
        
        // Show driver name if available
        val addressText = buildString {
            append(order.deliveryAddress ?: "Address not provided")
            if (order.driver != null) {
                append("\nDriver: ${order.driver?.name ?: "Unknown"}")
            }
        }
        cardBinding.addressText.text = addressText
        
        cardBinding.amountText.text = "KES ${String.format("%.2f", order.totalAmount ?: 0.0)}"

        // Display payment method and transaction details
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

    private fun getStatusColor(status: String): Int {
        return when (status) {
            "completed" -> getColor(R.color.status_completed)
            "delivered" -> getColor(R.color.status_delivered)
            else -> getColor(R.color.status_default)
        }
    }
    
    private fun buildPaymentInfo(order: Order): String {
        val paymentMethod = order.paymentMethod?.lowercase() ?: return ""
        
        return when (paymentMethod) {
            "cash" -> "Cash"
            "mobile_money" -> {
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

    private fun updateStats(orders: List<Order>) {
        val now = Calendar.getInstance()
        val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
        now.timeZone = nairobiTimeZone

        val todayStart = Calendar.getInstance(nairobiTimeZone).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val weekStart = Calendar.getInstance(nairobiTimeZone).apply {
            set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val monthStart = Calendar.getInstance(nairobiTimeZone).apply {
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        var ordersToday = 0
        var ordersWeek = 0
        var ordersMonth = 0

        orders.forEach { order ->
            val orderDate = parseOrderDate(order.updatedAt ?: order.createdAt) ?: return@forEach

            if (orderDate >= todayStart.time) {
                ordersToday++
            }

            if (orderDate >= weekStart.time) {
                ordersWeek++
            }

            if (orderDate >= monthStart.time) {
                ordersMonth++
            }
        }

        binding.ordersTodayText.text = ordersToday.toString()
        binding.ordersWeekText.text = ordersWeek.toString()
        binding.ordersMonthText.text = ordersMonth.toString()
    }
    
    private fun parseOrderDate(dateString: String?): Date? {
        if (dateString == null) return null

        val utcTimeZone = TimeZone.getTimeZone("UTC")
        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd'T'HH:mm:ss"
        )

        for (format in formats) {
            try {
                val parser = SimpleDateFormat(format, Locale.getDefault())
                parser.timeZone = utcTimeZone
                val date = parser.parse(dateString)
                if (date != null) {
                    return date
                }
            } catch (e: Exception) {
                // Try next format
            }
        }

        return null
    }

    private fun openOrderDetails(orderId: Int) {
        val intent = Intent(this, OrderDetailActivity::class.java)
        intent.putExtra("orderId", orderId)
        startActivity(intent)
    }
}
