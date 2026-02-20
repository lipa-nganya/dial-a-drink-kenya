package com.dialadrink.driver.ui.admin

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.DriverTransaction
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.databinding.ActivityPendingOrdersBinding
import com.dialadrink.driver.databinding.ItemTransactionRowBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.SimpleDateFormat
import java.util.*

class DriverTransactionsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPendingOrdersBinding
    private val TAG = "DriverTransactions"
    private var isLoading = false
    private var driverId: Int = -1
    private var driverName: String = ""
    private var showLoanPenaltyTransactions: Boolean = false
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
    private val dateFormatInput = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val dateFormatInput2 = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPendingOrdersBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        driverId = intent.getIntExtra("driverId", -1)
        driverName = intent.getStringExtra("driverName") ?: "Driver"
        showLoanPenaltyTransactions = intent.getBooleanExtra("showLoanPenaltyTransactions", false)
        
        Log.d(TAG, "onCreate: driverId=$driverId, driverName=$driverName, showLoanPenaltyTransactions=$showLoanPenaltyTransactions")
        
        if (driverId == -1) {
            Log.e(TAG, "❌ Invalid driverId, finishing activity")
            Toast.makeText(this, "Invalid driver ID", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        setupToolbar()
        setupSwipeRefresh()
        if (showLoanPenaltyTransactions) {
            loadLoanPenaltyTransactions()
        } else {
            loadCompletedOrders()
        }
    }
    
    override fun onResume() {
        super.onResume()
        if (!isLoading) {
            if (showLoanPenaltyTransactions) {
                loadLoanPenaltyTransactions()
            } else {
                loadCompletedOrders()
            }
        }
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = driverName
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setColorSchemeColors(getColor(R.color.accent))
        binding.swipeRefresh.setOnRefreshListener {
            if (showLoanPenaltyTransactions) {
                loadLoanPenaltyTransactions()
            } else {
                loadCompletedOrders()
            }
        }
    }
    
    private fun loadCompletedOrders() {
        if (isLoading) {
            Log.d(TAG, "⚠️ Already loading, skipping")
            return
        }
        
        Log.d(TAG, "🔄 Starting to load completed orders for driver $driverId")
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            var orders = emptyList<Order>()
            try {
                orders = withTimeoutOrNull(15000) {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(this@DriverTransactionsActivity)
                    }
                    
                    Log.d(TAG, "📡 Calling API: GET /api/driver-orders/$driverId?status=completed")
                    val response = ApiClient.getApiService().getDriverOrdersDirect(
                        driverId,
                        status = "completed",
                        summary = false
                    )
                    
                    Log.d(TAG, "📡 Response received: code=${response.code()}, success=${response.isSuccessful}, hasBody=${response.body() != null}")
                    
                    if (!response.isSuccessful || response.body() == null) {
                        val errorBody = response.errorBody()?.string()
                        Log.w(TAG, "❌ Failed to fetch orders: ${response.code()}, Error: $errorBody")
                        withContext(Dispatchers.Main) {
                            Toast.makeText(this@DriverTransactionsActivity, "Failed to load orders: ${response.code()}", Toast.LENGTH_SHORT).show()
                        }
                        emptyList()
                    } else {
                        val apiResponse = response.body()!!
                        Log.d(TAG, "API Response success: ${apiResponse.success}, Data: ${apiResponse.data?.size ?: 0} orders")
                        if (apiResponse.success != true || apiResponse.data == null) {
                            Log.w(TAG, "❌ API returned error: ${apiResponse.error}")
                            withContext(Dispatchers.Main) {
                                Toast.makeText(this@DriverTransactionsActivity, "Error: ${apiResponse.error ?: "Unknown error"}", Toast.LENGTH_SHORT).show()
                            }
                            emptyList()
                        } else {
                            val orders = apiResponse.data!!
                            // Filter for completed orders only and sort by date descending
                            val completedOrders = orders.filter { it.status == "completed" }
                                .sortedByDescending { it.createdAt ?: "" }
                            Log.d(TAG, "✅ Loaded ${completedOrders.size} completed orders for driver $driverId")
                            if (completedOrders.isNotEmpty()) {
                                Log.d(TAG, "First order: orderId=${completedOrders[0].id}, date=${completedOrders[0].createdAt}, location=${completedOrders[0].deliveryAddress}")
                            }
                            completedOrders
                        }
                    }
                } ?: emptyList()
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error loading orders", e)
                orders = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    Log.d(TAG, "📋 Final order count: ${orders.size}")
                    if (orders.isEmpty()) {
                        Log.d(TAG, "📭 No orders, showing empty state")
                        showEmptyState("No completed orders found for this driver")
                    } else {
                        Log.d(TAG, "📊 Displaying ${orders.size} orders")
                        displayOrders(orders)
                    }
                }
            }
        }
    }
    
    private fun showEmptyState(message: String) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        // Clear any table/content from container
        binding.ordersContainer.removeAllViews()
        
        // Show empty state text (it's now outside the container in a FrameLayout)
        binding.emptyStateText.text = message
        binding.emptyStateText.visibility = View.VISIBLE
        Log.d(TAG, "📭 Showing empty state: $message")
    }
    
    private fun displayOrders(orders: List<Order>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        
        // Clear existing content
        binding.ordersContainer.removeAllViews()
        
        if (orders.isEmpty()) {
            showEmptyState("No completed orders found")
            return
        }
        
        Log.d(TAG, "Creating table with ${orders.size} orders")
        
        // Create a TableLayout to hold the table rows
        val tableLayout = TableLayout(this).apply {
            val params = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
            visibility = View.VISIBLE
        }
        
        // Create table header
        val headerRow = createTableHeader()
        tableLayout.addView(headerRow)
        Log.d(TAG, "Added header row to table")
        
        // Add order rows
        orders.forEachIndexed { index, order ->
            try {
                val row = createOrderRow(order)
                tableLayout.addView(row)
                if (index < 3) {
                    Log.d(TAG, "Added order row $index to table")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating row for order ${order.id}", e)
            }
        }
        
        // Add the table to the container with proper layout params
        val containerParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        )
        binding.ordersContainer.addView(tableLayout, containerParams)
        
        Log.d(TAG, "✅ Added table to container. Container child count: ${binding.ordersContainer.childCount}, TableLayout child count: ${tableLayout.childCount}")
        
        // Ensure container is visible
        binding.ordersContainer.visibility = View.VISIBLE
        tableLayout.visibility = View.VISIBLE
        
        // Force layout update
        binding.ordersContainer.requestLayout()
        binding.ordersContainer.invalidate()
        tableLayout.requestLayout()
        tableLayout.invalidate()
    }
    
    private fun createTableHeader(): View {
        val headerRow = TableRow(this).apply {
            layoutParams = TableLayout.LayoutParams(
                TableLayout.LayoutParams.MATCH_PARENT,
                TableLayout.LayoutParams.WRAP_CONTENT
            )
            setBackgroundColor(getColor(R.color.accent))
            setPadding(12, 12, 12, 12)
            minimumHeight = 40
        }
        
        val columns = listOf("Order #", "Date", "Location", "Method", "Value", "Fee")
        val weights = listOf(0.8f, 1.2f, 2f, 1f, 1f, 1f)
        
        columns.forEachIndexed { index, columnName ->
            val textView = TextView(this).apply {
                text = columnName
                setTextColor(getColor(android.R.color.white))
                textSize = 12f
                setTypeface(null, android.graphics.Typeface.BOLD)
                gravity = when (index) {
                    0, 1, 2, 3 -> android.view.Gravity.START
                    else -> android.view.Gravity.END
                }
                setPadding(8, 8, 8, 8)
            }
            val layoutParams = TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, weights[index])
            headerRow.addView(textView, layoutParams)
        }
        
        return headerRow
    }
    
    private fun createOrderRow(order: Order): View {
        val rowBinding = ItemTransactionRowBinding.inflate(LayoutInflater.from(this))
        val row = rowBinding.root
        
        // Ensure row is visible
        row.visibility = View.VISIBLE
        
        // Order number
        rowBinding.orderNumberText.text = "#${order.id}"
        rowBinding.orderNumberText.visibility = View.VISIBLE
        
        // Format date as YYYY-MM-DD (convert from UTC to EAT)
        val dateText = try {
            order.createdAt?.let { dateStr ->
                try {
                    val utcFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                    utcFormat.timeZone = TimeZone.getTimeZone("UTC")
                    val date = utcFormat.parse(dateStr) ?: try {
                        val utcFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
                        utcFormat2.timeZone = TimeZone.getTimeZone("UTC")
                        utcFormat2.parse(dateStr)
                    } catch (e: Exception) {
                        null
                    }
                    date?.let {
                        val eatFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                        eatFormat.timeZone = TimeZone.getTimeZone("Africa/Nairobi")
                        eatFormat.format(it)
                    } ?: dateStr.substring(0, 10).takeIf { dateStr.length >= 10 } ?: dateStr
                } catch (e: Exception) {
                    dateStr.substring(0, 10).takeIf { dateStr.length >= 10 } ?: dateStr
                }
            } ?: "N/A"
        } catch (e: Exception) {
            "N/A"
        }
        rowBinding.dateText.text = dateText
        rowBinding.dateText.visibility = View.VISIBLE
        
        // Location - extract first 2 words from delivery address
        val locationText = order.deliveryAddress?.let { address ->
            val words = address.trim().split("\\s+".toRegex())
            if (words.size >= 2) {
                "${words[0]} ${words[1]}"
            } else {
                words.firstOrNull() ?: "N/A"
            }
        } ?: "N/A"
        rowBinding.locationText.text = locationText
        rowBinding.locationText.visibility = View.VISIBLE
        
        // Payment method (uppercase, e.g., "CASH")
        val paymentMethod = when (order.paymentMethod?.lowercase()) {
            "cash" -> "CASH"
            "mobile_money", "mpesa_prompt" -> "M-PESA"
            "card" -> "CARD"
            else -> order.paymentMethod?.uppercase() ?: "N/A"
        }
        rowBinding.methodText.text = paymentMethod
        rowBinding.methodText.visibility = View.VISIBLE
        
        // Value column should show order cost/subtotal (cost of inventory items bought by customer)
        // Calculate from items: sum of (price * quantity)
        val orderCost = if (order.items.isNotEmpty()) {
            order.items.sumOf { (it.price ?: 0.0) * (it.quantity ?: 0) }
        } else {
            // Fallback: totalAmount - deliveryFee - tipAmount
            (order.totalAmount ?: 0.0) - (order.deliveryFee ?: 0.0) - (order.tipAmount ?: 0.0)
        }
        val value = orderCost.toInt().toString()
        rowBinding.valueText.text = value
        rowBinding.valueText.visibility = View.VISIBLE
        
        // Fee column should show ONLY the delivery fee
        val fee = (order.deliveryFee ?: 0.0).toInt().toString()
        rowBinding.feeText.text = fee
        rowBinding.feeText.visibility = View.VISIBLE
        
        Log.d(TAG, "Created row: date=$dateText, location=$locationText, method=$paymentMethod, value=$value, fee=$fee")
        
        return row
    }
    
    private fun loadLoanPenaltyTransactions() {
        if (isLoading) {
            Log.d(TAG, "⚠️ Already loading, skipping")
            return
        }
        
        Log.d(TAG, "🔄 Starting to load loan/penalty transactions for driver $driverId")
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            var transactions = emptyList<DriverTransaction>()
            try {
                transactions = withTimeoutOrNull(15000) {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(this@DriverTransactionsActivity)
                    }
                    
                    Log.d(TAG, "📡 Calling API: GET /api/admin/drivers/$driverId/loan-penalty-transactions")
                    val response = ApiClient.getApiService().getLoanPenaltyTransactions(driverId)
                    
                    Log.d(TAG, "📡 Response received: code=${response.code()}, success=${response.isSuccessful}, hasBody=${response.body() != null}")
                    
                    if (!response.isSuccessful || response.body() == null) {
                        val errorBody = response.errorBody()?.string()
                        Log.w(TAG, "❌ Failed to fetch transactions: ${response.code()}, Error: $errorBody")
                        withContext(Dispatchers.Main) {
                            Toast.makeText(this@DriverTransactionsActivity, "Failed to load transactions: ${response.code()}", Toast.LENGTH_SHORT).show()
                        }
                        emptyList()
                    } else {
                        val apiResponse = response.body()!!
                        Log.d(TAG, "API Response success: ${apiResponse.success}, Data: ${apiResponse.data?.size ?: 0} transactions")
                        if (apiResponse.success != true || apiResponse.data == null) {
                            Log.w(TAG, "❌ API returned error: ${apiResponse.error}")
                            withContext(Dispatchers.Main) {
                                Toast.makeText(this@DriverTransactionsActivity, "Error: ${apiResponse.error ?: "Unknown error"}", Toast.LENGTH_SHORT).show()
                            }
                            emptyList()
                        } else {
                            val transactions = apiResponse.data!!
                            Log.d(TAG, "✅ Loaded ${transactions.size} loan/penalty transactions for driver $driverId")
                            transactions
                        }
                    }
                } ?: emptyList()
            } catch (e: CancellationException) {
                // Ignore
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error loading transactions", e)
                transactions = emptyList()
            } finally {
                isLoading = false
                withContext(Dispatchers.Main) {
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    Log.d(TAG, "📋 Final transaction count: ${transactions.size}")
                    if (transactions.isEmpty()) {
                        Log.d(TAG, "📭 No transactions, showing empty state")
                        showEmptyState("No loan/penalty transactions found for this driver")
                    } else {
                        Log.d(TAG, "📊 Displaying ${transactions.size} transactions")
                        displayLoanPenaltyTransactions(transactions)
                    }
                }
            }
        }
    }
    
    private fun displayLoanPenaltyTransactions(transactions: List<DriverTransaction>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        
        // Clear existing content
        binding.ordersContainer.removeAllViews()
        
        if (transactions.isEmpty()) {
            showEmptyState("No loan/penalty transactions found")
            return
        }
        
        Log.d(TAG, "Creating table with ${transactions.size} transactions")
        
        // Create a TableLayout to hold the table rows
        val tableLayout = TableLayout(this).apply {
            val params = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
            layoutParams = params
            visibility = View.VISIBLE
        }
        
        // Create table header for loan/penalty transactions
        val headerRow = createLoanPenaltyTableHeader()
        tableLayout.addView(headerRow)
        Log.d(TAG, "Added header row to table")
        
        // Add transaction rows
        transactions.forEachIndexed { index, transaction ->
            try {
                val row = createLoanPenaltyTransactionRow(transaction)
                tableLayout.addView(row)
                if (index < 3) {
                    Log.d(TAG, "Added transaction row $index to table")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating row for transaction ${transaction.id}", e)
            }
        }
        
        // Add the table to the container
        val containerParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        )
        binding.ordersContainer.addView(tableLayout, containerParams)
        
        Log.d(TAG, "✅ Added table to container. Container child count: ${binding.ordersContainer.childCount}, TableLayout child count: ${tableLayout.childCount}")
        
        // Ensure container is visible
        binding.ordersContainer.visibility = View.VISIBLE
        tableLayout.visibility = View.VISIBLE
        
        // Force layout update
        binding.ordersContainer.requestLayout()
        binding.ordersContainer.invalidate()
        tableLayout.requestLayout()
        tableLayout.invalidate()
    }
    
    private fun createLoanPenaltyTableHeader(): View {
        val headerRow = TableRow(this).apply {
            layoutParams = TableLayout.LayoutParams(
                TableLayout.LayoutParams.MATCH_PARENT,
                TableLayout.LayoutParams.WRAP_CONTENT
            )
            setBackgroundColor(getColor(R.color.accent))
            setPadding(12, 12, 12, 12)
            minimumHeight = 40
        }
        
        val columns = listOf("Date", "Type", "Description", "Amount")
        val weights = listOf(1.5f, 1.5f, 3f, 1.5f)
        
        columns.forEachIndexed { index, columnName ->
            val textView = TextView(this).apply {
                text = columnName
                setTextColor(getColor(android.R.color.white))
                textSize = 12f
                setTypeface(null, android.graphics.Typeface.BOLD)
                gravity = when (index) {
                    0, 1, 2 -> android.view.Gravity.START
                    else -> android.view.Gravity.END
                }
                setPadding(8, 8, 8, 8)
            }
            val layoutParams = TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, weights[index])
            headerRow.addView(textView, layoutParams)
        }
        
        return headerRow
    }
    
    private fun createLoanPenaltyTransactionRow(transaction: DriverTransaction): View {
        val rowBinding = ItemTransactionRowBinding.inflate(LayoutInflater.from(this))
        val row = rowBinding.root
        
        // Ensure row is visible
        row.visibility = View.VISIBLE
        
        // Hide order number column (not used for loan/penalty transactions)
        rowBinding.orderNumberText.visibility = View.GONE
        
        // Format date as YYYY-MM-DD (convert from UTC to EAT)
        val dateText = try {
            (transaction.createdAt ?: transaction.date)?.let { dateStr ->
                try {
                    val utcFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                    utcFormat.timeZone = TimeZone.getTimeZone("UTC")
                    val date = utcFormat.parse(dateStr) ?: try {
                        val utcFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
                        utcFormat2.timeZone = TimeZone.getTimeZone("UTC")
                        utcFormat2.parse(dateStr)
                    } catch (e: Exception) {
                        null
                    }
                    date?.let {
                        val eatFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
                        eatFormat.timeZone = TimeZone.getTimeZone("Africa/Nairobi")
                        eatFormat.format(it)
                    } ?: dateStr.substring(0, 10).takeIf { dateStr.length >= 10 } ?: dateStr
                } catch (e: Exception) {
                    dateStr.substring(0, 10).takeIf { dateStr.length >= 10 } ?: dateStr
                }
            } ?: "N/A"
        } catch (e: Exception) {
            "N/A"
        }
        rowBinding.dateText.text = dateText
        rowBinding.dateText.visibility = View.VISIBLE
        
        // Type column - determine transaction type from notes and paymentProvider
        val typeText = when {
            transaction.notes?.contains("Loan added", ignoreCase = true) == true -> "Loan Added"
            transaction.notes?.contains("Penalty added", ignoreCase = true) == true -> "Penalty Added"
            transaction.notes?.contains("Savings Recovery", ignoreCase = true) == true -> "Loan Recovery"
            transaction.notes?.contains("Penalty paid", ignoreCase = true) == true -> "Penalty Paid"
            transaction.paymentProvider == "loan" -> "Loan"
            transaction.paymentProvider == "penalty" -> "Penalty"
            transaction.paymentProvider == "penalty_payment" -> "Penalty Payment"
            transaction.paymentProvider == "savings_recovery" -> "Loan Recovery"
            else -> transaction.transactionType ?: "N/A"
        }
        rowBinding.locationText.text = typeText
        rowBinding.locationText.visibility = View.VISIBLE
        
        // Description column - show notes
        val descriptionText = transaction.notes ?: "N/A"
        rowBinding.methodText.text = descriptionText
        rowBinding.methodText.visibility = View.VISIBLE
        
        // Amount column - show amount with sign
        val amount = transaction.amount ?: 0.0
        val amountText = if (amount >= 0) {
            "+KES ${kotlin.math.abs(amount).toInt()}"
        } else {
            "-KES ${kotlin.math.abs(amount).toInt()}"
        }
        rowBinding.valueText.text = amountText
        rowBinding.valueText.visibility = View.VISIBLE
        
        // Hide fee column (not used for loan/penalty transactions)
        rowBinding.feeText.visibility = View.GONE
        
        Log.d(TAG, "Created transaction row: date=$dateText, type=$typeText, description=$descriptionText, amount=$amountText")
        
        return row
    }
}
