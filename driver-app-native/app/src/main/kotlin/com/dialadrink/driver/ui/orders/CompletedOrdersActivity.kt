package com.dialadrink.driver.ui.orders

import android.app.DatePickerDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.databinding.ActivityCompletedOrdersBinding
import com.dialadrink.driver.databinding.ItemCompletedOrderRowBinding
import com.dialadrink.driver.ui.auth.PinVerificationDialog
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.*

class CompletedOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCompletedOrdersBinding
    private var isLoading = false
    private var currentOrders = emptyList<Order>()
    private var fromDate: Date? = null
    private var toDate: Date? = null
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    
    // Earnings visibility state
    private var earningsVisible = false
    private var earningsToday = 0.0
    private var earningsWeek = 0.0
    private var earningsMonth = 0.0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCompletedOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupSwipeRefresh()
        setupDatePickers()
        setupEarningsCards()
        loadOrders()
    }
    
    private fun setupEarningsCards() {
        // Set click listeners on all earnings cards
        binding.earningsTodayCard.setOnClickListener {
            toggleEarningsVisibility()
        }
        binding.earningsWeekCard.setOnClickListener {
            toggleEarningsVisibility()
        }
        binding.earningsMonthCard.setOnClickListener {
            toggleEarningsVisibility()
        }
        
        // Hide earnings by default
        hideEarnings()
    }
    
    private fun toggleEarningsVisibility() {
        if (earningsVisible) {
            // Hide earnings
            hideEarnings()
        } else {
            // Show PIN dialog to reveal earnings
            showPinVerificationDialog()
        }
    }
    
    private fun showPinVerificationDialog() {
        val dialog = PinVerificationDialog()
        dialog.setOnVerifiedListener {
            // PIN verified - show earnings
            showEarnings()
        }
        dialog.setOnCancelledListener {
            // User cancelled - keep earnings hidden
        }
        dialog.show(supportFragmentManager, "PinVerificationDialog")
    }
    
    private fun showEarnings() {
        earningsVisible = true
        binding.earningsTodayText.text = "KES ${String.format("%.2f", earningsToday)}"
        binding.earningsWeekText.text = "KES ${String.format("%.2f", earningsWeek)}"
        binding.earningsMonthText.text = "KES ${String.format("%.2f", earningsMonth)}"
    }
    
    private fun hideEarnings() {
        earningsVisible = false
        binding.earningsTodayText.text = "••••"
        binding.earningsWeekText.text = "••••"
        binding.earningsMonthText.text = "••••"
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
                    OrderRepository.getCompletedOrders(
                        this@CompletedOrdersActivity,
                        fromDate = fromDate,
                        toDate = toDate
                    )
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

                    val ordersChanged = orders.map { it.id }.toSet() != previousOrders.map { it.id }.toSet()

                    // Update stats first
                    updateStats(orders)
                    
                    if (orders.isEmpty()) {
                        showEmptyState("No completed orders")
                        currentOrders = emptyList()
                    } else {
                        displayOrders(orders)
                        currentOrders = orders

                        if (!ordersChanged && previousOrders.isNotEmpty()) {
                            Toast.makeText(
                                this@CompletedOrdersActivity,
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
        binding.tableHeader.visibility = View.GONE
        removeOrderCards()
        binding.emptyStateText.text = message
        binding.emptyStateText.visibility = View.VISIBLE
    }

    private fun displayOrders(orders: List<Order>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        binding.tableHeader.visibility = View.VISIBLE
        removeOrderCards()

        orders.forEach { order ->
            val orderCard = createOrderRow(order)
            val layoutParams = android.widget.LinearLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                val marginInDp = 0
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
            if (child.id != R.id.tableHeader && child.id != R.id.emptyStateText) {
                binding.ordersContainer.removeViewAt(i)
            }
        }
    }

    private fun createOrderRow(order: Order): View {
        val rowBinding = ItemCompletedOrderRowBinding.inflate(LayoutInflater.from(this))
        val row = rowBinding.root

        rowBinding.locationText.text = order.deliveryAddress ?: "Address not provided"
        rowBinding.orderValueText.text = "KES ${String.format("%.2f", order.totalAmount)}"
        rowBinding.paymentMethodText.text = getPaymentMethodLabel(order.paymentMethod)
        val territoryDeliveryFee = (order.territoryDeliveryFee ?: order.deliveryFee) ?: 0.0
        if (territoryDeliveryFee > 0.009) {
            rowBinding.deliveryFeeText.visibility = View.VISIBLE
            rowBinding.deliveryFeeText.text = "KES ${String.format("%.2f", territoryDeliveryFee)}"
        } else {
            rowBinding.deliveryFeeText.visibility = View.GONE
        }

        row.setOnClickListener {
            openOrderDetails(order.id)
        }
        return row
    }

    private fun getPaymentMethodLabel(paymentMethod: String?): String {
        return when (paymentMethod?.lowercase()) {
            "mobile_money" -> "M-Pesa"
            "cash" -> "Cash"
            "card" -> "Card"
            "cash_at_hand" -> "Cash At Hand"
            null, "" -> "-"
            else -> paymentMethod.replace("_", " ").replaceFirstChar { it.uppercase() }
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
                    // Format: M-Pesa\nCODE\nDD/MM/YY HH:MM:SS
                    val formattedDate = formatTransactionDate(transactionDate)
                    "M-Pesa\n$transactionCode\n$formattedDate"
                } else if (transactionCode != null) {
                    // Just show code if date is missing
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
            // Try parsing various date formats (UTC)
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd HH:mm:ss",
                "yyyy-MM-dd'T'HH:mm:ss"
            )
            
            // Set UTC timezone for parsing
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
                // Format as DD/MM/YY HH:MM:SS in Nairobi timezone (EAT, UTC+3)
                val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
                val formatter = SimpleDateFormat("dd/MM/yy HH:mm:ss", Locale.getDefault())
                formatter.timeZone = nairobiTimeZone
                formatter.format(date)
            } else {
                dateString // Return original if parsing fails
            }
        } catch (e: Exception) {
            dateString // Return original if formatting fails
        }
    }

    private fun updateStats(orders: List<Order>) {
        val now = Calendar.getInstance()
        val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
        now.timeZone = nairobiTimeZone

        // Today: start of today
        val todayStart = Calendar.getInstance(nairobiTimeZone).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // This week: start of week (Monday)
        val weekStart = Calendar.getInstance(nairobiTimeZone).apply {
            set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // This month: start of month
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
        var earningsToday = 0.0
        var earningsWeek = 0.0
        var earningsMonth = 0.0

        orders.forEach { order ->
            val orderDate = parseOrderDate(order.createdAt) ?: return@forEach

            // Use delivery fee only for earnings (not order cost)
            val deliveryFee = order.territoryDeliveryFee ?: order.deliveryFee

            // Count and sum for today
            if (orderDate >= todayStart.time) {
                ordersToday++
                earningsToday += deliveryFee
            }

            // Count and sum for this week
            if (orderDate >= weekStart.time) {
                ordersWeek++
                earningsWeek += deliveryFee
            }

            // Count and sum for this month
            if (orderDate >= monthStart.time) {
                ordersMonth++
                earningsMonth += deliveryFee
            }
        }

        // Store earnings values
        this.earningsToday = earningsToday
        this.earningsWeek = earningsWeek
        this.earningsMonth = earningsMonth
        
        // Update UI (labels are now in the card layout, only show values)
        binding.ordersTodayText.text = ordersToday.toString()
        binding.ordersWeekText.text = ordersWeek.toString()
        binding.ordersMonthText.text = ordersMonth.toString()
        
        // Update earnings display based on visibility state
        if (earningsVisible) {
            showEarnings()
        } else {
            hideEarnings()
        }
    }
    
    override fun onPause() {
        super.onPause()
        // Auto-hide earnings when navigating away
        if (earningsVisible) {
            hideEarnings()
        }
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
                    return date // Date objects are timezone-agnostic, represent a moment in time
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
