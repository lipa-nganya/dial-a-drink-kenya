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
        
        Log.d(TAG, "onCreate: driverId=$driverId, driverName=$driverName")
        
        if (driverId == -1) {
            Log.e(TAG, "❌ Invalid driverId, finishing activity")
            Toast.makeText(this, "Invalid driver ID", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        setupToolbar()
        setupSwipeRefresh()
        loadTransactions()
    }
    
    override fun onResume() {
        super.onResume()
        if (!isLoading) {
            loadTransactions()
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
            loadTransactions()
        }
    }
    
    private fun loadTransactions() {
        if (isLoading) {
            Log.d(TAG, "⚠️ Already loading, skipping")
            return
        }
        
        Log.d(TAG, "🔄 Starting to load transactions for driver $driverId")
        
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
                    
                    Log.d(TAG, "📡 Calling API: GET /api/admin/drivers/$driverId/transactions")
                    val response = ApiClient.getApiService().getDriverTransactions(driverId)
                    
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
                            Log.d(TAG, "✅ Loaded ${transactions.size} transactions for driver $driverId")
                            if (transactions.isNotEmpty()) {
                                Log.d(TAG, "First transaction: orderId=${transactions[0].orderId}, date=${transactions[0].date}, location=${transactions[0].location}")
                            }
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
                        showEmptyState("No transactions found for this driver")
                    } else {
                        Log.d(TAG, "📊 Displaying ${transactions.size} transactions")
                        displayTransactions(transactions)
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
    
    private fun displayTransactions(transactions: List<DriverTransaction>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.emptyStateText.visibility = View.GONE
        
        // Clear existing content
        binding.ordersContainer.removeAllViews()
        
        if (transactions.isEmpty()) {
            showEmptyState("No transactions found")
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
        
        // Create table header
        val headerRow = createTableHeader()
        tableLayout.addView(headerRow)
        Log.d(TAG, "Added header row to table")
        
        // Add transaction rows
        transactions.forEachIndexed { index, transaction ->
            try {
                val row = createTransactionRow(transaction)
                tableLayout.addView(row)
                if (index < 3) {
                    Log.d(TAG, "Added transaction row $index to table")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating row for transaction ${transaction.id}", e)
            }
        }
        
        // Add the table to the container with proper layout params
        val containerParams = android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        )
        binding.ordersContainer.addView(tableLayout, containerParams)
        
        Log.d(TAG, "✅ Added table to container. Container child count: ${binding.ordersContainer.childCount}, TableLayout child count: ${tableLayout.childCount}")
        Log.d(TAG, "✅ Container visibility: ${binding.ordersContainer.visibility}, TableLayout visibility: ${tableLayout.visibility}")
        Log.d(TAG, "✅ Container width: ${binding.ordersContainer.width}, height: ${binding.ordersContainer.height}")
        Log.d(TAG, "✅ TableLayout width: ${tableLayout.width}, height: ${tableLayout.height}")
        
        // Ensure container is visible
        binding.ordersContainer.visibility = View.VISIBLE
        tableLayout.visibility = View.VISIBLE
        
        // Force layout update
        binding.ordersContainer.requestLayout()
        binding.ordersContainer.invalidate()
        tableLayout.requestLayout()
        tableLayout.invalidate()
        
        // Post a runnable to check visibility after layout
        binding.ordersContainer.post {
            Log.d(TAG, "📐 After layout - Container: w=${binding.ordersContainer.width}, h=${binding.ordersContainer.height}, visible=${binding.ordersContainer.visibility}")
            Log.d(TAG, "📐 After layout - TableLayout: w=${tableLayout.width}, h=${tableLayout.height}, visible=${tableLayout.visibility}, children=${tableLayout.childCount}")
        }
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
        
        val columns = listOf("Date", "Location", "Method", "Value", "Fee")
        val weights = listOf(1.2f, 2f, 1f, 1f, 1f)
        
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
    
    private fun createTransactionRow(transaction: DriverTransaction): View {
        val rowBinding = ItemTransactionRowBinding.inflate(LayoutInflater.from(this))
        val row = rowBinding.root
        
        // Ensure row is visible
        row.visibility = View.VISIBLE
        
        // Format date as YYYY-MM-DD
        val dateText = try {
            transaction.date?.let { dateStr ->
                try {
                    val date = dateFormatInput.parse(dateStr) ?: dateFormatInput2.parse(dateStr)
                    date?.let { dateFormat.format(it) } ?: dateStr.substring(0, 10).takeIf { dateStr.length >= 10 } ?: dateStr
                } catch (e: Exception) {
                    dateStr.substring(0, 10).takeIf { dateStr.length >= 10 } ?: dateStr
                }
            } ?: "N/A"
        } catch (e: Exception) {
            "N/A"
        }
        rowBinding.dateText.text = dateText
        rowBinding.dateText.visibility = View.VISIBLE
        
        // Location
        rowBinding.locationText.text = transaction.location ?: "N/A"
        rowBinding.locationText.visibility = View.VISIBLE
        
        // Payment method (uppercase, e.g., "CASH")
        val paymentMethod = transaction.paymentMethod?.uppercase() ?: "N/A"
        rowBinding.methodText.text = paymentMethod
        rowBinding.methodText.visibility = View.VISIBLE
        
        // Value (amount without decimals)
        val value = transaction.amount.toInt().toString()
        rowBinding.valueText.text = value
        rowBinding.valueText.visibility = View.VISIBLE
        
        // Fee (delivery fee without decimals)
        val fee = transaction.deliveryFee.toInt().toString()
        rowBinding.feeText.text = fee
        rowBinding.feeText.visibility = View.VISIBLE
        
        Log.d(TAG, "Created row: date=$dateText, location=${transaction.location}, method=$paymentMethod, value=$value, fee=$fee")
        
        return row
    }
}
