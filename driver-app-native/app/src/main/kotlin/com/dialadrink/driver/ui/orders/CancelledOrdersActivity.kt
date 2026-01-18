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
import com.dialadrink.driver.databinding.ActivityCancelledOrdersBinding
import com.dialadrink.driver.databinding.ItemActiveOrderBinding
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.*

class CancelledOrdersActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCancelledOrdersBinding
    private var isLoading = false
    private var currentOrders = emptyList<Order>()
    private var fromDate: Date? = null
    private var toDate: Date? = null
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCancelledOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupToolbar()
        setupSwipeRefresh()
        setupDatePickers()
        loadOrders()
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
                    OrderRepository.getCancelledOrders(
                        this@CancelledOrdersActivity,
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

                    if (orders.isEmpty()) {
                        showEmptyState("No cancelled orders")
                        currentOrders = emptyList()
                    } else {
                        displayOrders(orders)
                        currentOrders = orders

                        if (!ordersChanged && previousOrders.isNotEmpty()) {
                            Toast.makeText(
                                this@CancelledOrdersActivity,
                                "Cancelled orders are up to date",
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

        val statusColor = getStatusColor(order.status)
        val drawable = android.graphics.drawable.GradientDrawable().apply {
            setColor(statusColor)
            cornerRadius = 12f * resources.displayMetrics.density
        }
        cardBinding.statusBadge.background = drawable
        cardBinding.statusText.text = order.status.replace("_", " ").uppercase()

        cardBinding.customerNameText.text = order.customerName ?: "Customer"
        cardBinding.addressText.text = order.deliveryAddress ?: "Address not provided"
        cardBinding.amountText.text = "KES ${String.format("%.2f", order.totalAmount)}"

        if (order.createdAt != null) {
            try {
                // Parse UTC date
                val utcTimeZone = TimeZone.getTimeZone("UTC")
                val parser1 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                parser1.timeZone = utcTimeZone
                val date = parser1.parse(order.createdAt)
                if (date != null) {
                    // Format in Nairobi timezone
                    val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
                    val formatter = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
                    formatter.timeZone = nairobiTimeZone
                    cardBinding.dateText.text = formatter.format(date)
                }
            } catch (e: Exception) {
                try {
                    // Try alternative format
                    val utcTimeZone = TimeZone.getTimeZone("UTC")
                    val parser2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
                    parser2.timeZone = utcTimeZone
                    val date = parser2.parse(order.createdAt)
                    if (date != null) {
                        // Format in Nairobi timezone
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

        // Hide action buttons (info icon and navigate button)
        cardBinding.actionButtons.visibility = View.GONE
        cardBinding.navigateButton.visibility = View.GONE
        
        card.setOnClickListener {
            openOrderDetails(order.id)
        }

        return card
    }

    private fun getStatusColor(status: String): Int {
        return when (status) {
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
