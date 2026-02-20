package com.dialadrink.driver.ui.admin

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityRiderDetailsBinding
import com.dialadrink.driver.databinding.DialogAddLoanBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.tabs.TabLayout
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class RiderDetailsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityRiderDetailsBinding
    private val TAG = "RiderDetailsActivity"
    private var driverId: Int = -1
    private var driverName: String = ""
    private var isLoading = false
    private var currentTab = 0 // 0 = Cash at Hand, 1 = Savings
    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE")).apply {
        maximumFractionDigits = 0
        minimumFractionDigits = 0
    }
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault())
    private val dateFormatInput = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRiderDetailsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        driverId = intent.getIntExtra("driverId", -1)
        driverName = intent.getStringExtra("driverName") ?: "Rider"
        
        if (driverId == -1) {
            Toast.makeText(this, "Invalid driver ID", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        setupToolbar()
        setupTabs()
        setupButtons()
        loadRiderInfo()
    }
    
    override fun onResume() {
        super.onResume()
        if (!isLoading) {
            loadRiderInfo()
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
    
    private fun setupTabs() {
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText("Cash at Hand"))
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText("Savings"))
        
        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                currentTab = tab?.position ?: 0
                loadTransactions()
            }
            
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }
    
    private fun setupButtons() {
        binding.addLoanButton.setOnClickListener {
            showAddLoanDialog()
        }
        
        binding.addPenaltyButton.setOnClickListener {
            showAddPenaltyDialog()
        }
        
        binding.swipeRefresh.setColorSchemeColors(getColor(R.color.accent))
        binding.swipeRefresh.setOnRefreshListener {
            loadRiderInfo()
            loadTransactions()
        }
    }
    
    private fun loadRiderInfo() {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@RiderDetailsActivity)
                }
                
                // Load driver info from drivers list
                val driversResponse = ApiClient.getApiService().getDrivers()
                if (driversResponse.isSuccessful && driversResponse.body()?.success == true) {
                    val drivers = driversResponse.body()!!.data ?: emptyList()
                    val driver = drivers.find { it.id == driverId }
                    withContext(Dispatchers.Main) {
                        binding.riderNameText.text = driver?.name ?: driverName
                        binding.creditLimitText.text = currencyFormat.format(driver?.creditLimit ?: 0.0)
                    }
                }
                
                // Load cash at hand
                val cashAtHandResponse = ApiClient.getApiService().getCashAtHand(driverId)
                if (cashAtHandResponse.isSuccessful && cashAtHandResponse.body()?.success == true) {
                    val cashAtHandData = cashAtHandResponse.body()!!.data
                    withContext(Dispatchers.Main) {
                        binding.cashAtHandText.text = currencyFormat.format(cashAtHandData?.totalCashAtHand ?: 0.0)
                    }
                }
                
                // Load savings balance
                val walletResponse = ApiClient.getApiService().getDriverWallet(driverId)
                if (walletResponse.isSuccessful && walletResponse.body()?.success == true) {
                    val walletData = walletResponse.body()!!.data
                    withContext(Dispatchers.Main) {
                        val savings = walletData?.wallet?.savings ?: 0.0
                        binding.savingsBalanceText.text = currencyFormat.format(savings)
                        if (savings < 0) {
                            binding.savingsBalanceText.setTextColor(android.graphics.Color.parseColor("#f44336"))
                        } else {
                            binding.savingsBalanceText.setTextColor(getColor(R.color.text_primary_dark))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading rider info: ${e.message}", e)
            }
        }
    }
    
    private fun loadTransactions() {
        if (isLoading) return
        
        isLoading = true
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@RiderDetailsActivity)
                }
                
                if (currentTab == 0) {
                    // Cash at Hand tab
                    loadCashAtHandTransactions()
                } else {
                    // Savings tab
                    loadSavingsTransactions()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading transactions: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    isLoading = false
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                }
            }
        }
    }
    
    private suspend fun loadCashAtHandTransactions() {
        try {
            val response = ApiClient.getApiService().getCashAtHand(driverId)
            
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()!!.data
                val entries = data?.entries ?: emptyList()
                
                withContext(Dispatchers.Main) {
                    displayCashAtHandTransactions(entries)
                }
            } else {
                withContext(Dispatchers.Main) {
                    showEmptyState("No cash at hand transactions found")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading cash at hand transactions: ${e.message}", e)
            withContext(Dispatchers.Main) {
                showEmptyState("Error loading transactions")
            }
        } finally {
            isLoading = false
            withContext(Dispatchers.Main) {
                binding.loadingProgress.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }
    
    private suspend fun loadSavingsTransactions() {
        try {
            val response = ApiClient.getApiService().getDriverWallet(driverId)
            
            if (response.isSuccessful && response.body()?.success == true) {
                val data = response.body()!!.data
                // Get all savings-related transactions
                val savingsCredits = data?.recentSavingsCredits ?: emptyList()
                val cashSettlements = data?.cashSettlements ?: emptyList()
                
                // Filter for Savings Recovery transactions only
                val savingsRecoveryTransactions = mutableListOf<WalletTransaction>()
                savingsCredits.forEach { transaction ->
                    if (transaction.notes?.contains("Savings Recovery", ignoreCase = true) == true) {
                        savingsRecoveryTransactions.add(transaction)
                    }
                }
                cashSettlements.forEach { transaction ->
                    if (transaction.notes?.contains("Savings Recovery", ignoreCase = true) == true) {
                        savingsRecoveryTransactions.add(transaction)
                    }
                }
                
                // Sort by date descending
                val sortedTransactions = savingsRecoveryTransactions.sortedByDescending { transaction ->
                    try {
                        dateFormatInput.parse(transaction.date ?: "") ?: Date(0)
                    } catch (e: Exception) {
                        Date(0)
                    }
                }
                
                withContext(Dispatchers.Main) {
                    displaySavingsTransactions(sortedTransactions)
                }
            } else {
                withContext(Dispatchers.Main) {
                    showEmptyState("No savings transactions found")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading savings transactions: ${e.message}", e)
            withContext(Dispatchers.Main) {
                showEmptyState("Error loading transactions")
            }
        } finally {
            isLoading = false
            withContext(Dispatchers.Main) {
                binding.loadingProgress.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }
    
    private fun displayCashAtHandTransactions(entries: List<CashAtHandEntry>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.transactionsContainer.removeAllViews()
        
        if (entries.isEmpty()) {
            showEmptyState("No cash at hand transactions found")
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        val tableLayout = TableLayout(this).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        
        // Create header
        val headerRow = createTransactionTableHeader()
        tableLayout.addView(headerRow)
        
        // Sort entries by date descending (newest first)
        val sortedEntries = entries.sortedByDescending { entry ->
            try {
                dateFormatInput.parse(entry.date) ?: Date(0)
            } catch (e: Exception) {
                Date(0)
            }
        }
        
        // Calculate total balance first (from oldest to newest)
        val totalBalance = sortedEntries.reversed().sumOf { entry ->
            if (entry.type == "cash_received") entry.amount else -entry.amount
        }
        
        // Calculate running balance backwards (from newest to oldest)
        var runningBalance = totalBalance
        sortedEntries.forEach { entry ->
            val amount = if (entry.type == "cash_received") entry.amount else -entry.amount
            
            val row = createCashAtHandRow(entry, amount, runningBalance)
            tableLayout.addView(row)
            
            // Subtract amount for next (older) transaction
            runningBalance -= amount
        }
        
        binding.transactionsContainer.addView(tableLayout)
    }
    
    private fun displaySavingsTransactions(transactions: List<WalletTransaction>) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.transactionsContainer.removeAllViews()
        
        if (transactions.isEmpty()) {
            showEmptyState("No savings recovery transactions found")
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        val tableLayout = TableLayout(this).apply {
            layoutParams = android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        
        // Create header
        val headerRow = createTransactionTableHeader()
        tableLayout.addView(headerRow)
        
        // Sort transactions by date descending (newest first) - already sorted, but ensure it
        val sortedTransactionsList = transactions.sortedByDescending { transaction ->
            try {
                dateFormatInput.parse(transaction.date ?: "") ?: Date(0)
            } catch (e: Exception) {
                Date(0)
            }
        }
        
        // Calculate total balance first (from oldest to newest)
        val totalBalance = sortedTransactionsList.reversed().sumOf { transaction ->
            transaction.amount ?: 0.0
        }
        
        // Calculate running balance backwards (from newest to oldest)
        var runningBalance = totalBalance
        sortedTransactionsList.forEach { transaction ->
            val amount = transaction.amount ?: 0.0
            
            val row = createSavingsRow(transaction, amount, runningBalance)
            tableLayout.addView(row)
            
            // Subtract amount for next (older) transaction
            runningBalance -= amount
        }
        
        binding.transactionsContainer.addView(tableLayout)
    }
    
    private fun createTransactionTableHeader(): TableRow {
        val headerRow = TableRow(this).apply {
            layoutParams = TableLayout.LayoutParams(
                TableLayout.LayoutParams.MATCH_PARENT,
                TableLayout.LayoutParams.WRAP_CONTENT
            )
            setBackgroundColor(getColor(R.color.accent))
            setPadding(12, 12, 12, 12)
        }
        
        val columns = listOf("Date & Time", "Description", "Debit", "Credit", "Balance")
        val weights = listOf(1.5f, 2f, 1f, 1f, 1f)
        
        columns.forEachIndexed { index, columnName ->
            val textView = TextView(this).apply {
                text = columnName
                setTextColor(getColor(android.R.color.white))
                textSize = 12f
                setTypeface(null, android.graphics.Typeface.BOLD)
                gravity = when (index) {
                    0, 1 -> android.view.Gravity.START
                    else -> android.view.Gravity.END
                }
                setPadding(8, 8, 8, 8)
            }
            val layoutParams = TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, weights[index])
            headerRow.addView(textView, layoutParams)
        }
        
        return headerRow
    }
    
    private fun createCashAtHandRow(entry: CashAtHandEntry, amount: Double, balance: Double): TableRow {
        val row = TableRow(this).apply {
            layoutParams = TableLayout.LayoutParams(
                TableLayout.LayoutParams.MATCH_PARENT,
                TableLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(12, 12, 12, 12)
        }
        
        // Date & Time
        val dateText = try {
            val date = dateFormatInput.parse(entry.date) ?: Date()
            dateFormat.format(date)
        } catch (e: Exception) {
            entry.date
        }
        val dateView = createTableCell(dateText, android.view.Gravity.START)
        row.addView(dateView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1.5f))
        
        // Description - clean up for Savings Recovery transactions
        var description = entry.description
        if (description.contains("Savings Recovery", ignoreCase = true)) {
            // Remove driver number and timestamp, change to "Loan Recovery"
            description = description.replace(Regex("Driver \\d+"), "")
                .replace(Regex("\\(KES [\\d.]+\\s*\\)"), "")
                .replace(Regex("- \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2} EAT"), "")
                .replace("Savings Recovery", "Loan Recovery", ignoreCase = true)
                .trim()
                .replace(Regex("\\s+"), " ") // Clean up multiple spaces
            if (description.isEmpty() || !description.contains("Loan Recovery", ignoreCase = true)) {
                description = "Loan Recovery"
            }
        }
        val descView = createTableCell(description, android.view.Gravity.START)
        row.addView(descView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 2f))
        
        // Debit (negative amounts)
        val debit = if (amount < 0) Math.abs(amount) else 0.0
        val debitView = createTableCell(currencyFormat.format(debit), android.view.Gravity.END)
        row.addView(debitView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f))
        
        // Credit (positive amounts)
        val credit = if (amount > 0) amount else 0.0
        val creditView = createTableCell(currencyFormat.format(credit), android.view.Gravity.END)
        row.addView(creditView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f))
        
        // Balance
        val balanceView = createTableCell(currencyFormat.format(balance), android.view.Gravity.END)
        row.addView(balanceView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f))
        
        return row
    }
    
    private fun createSavingsRow(transaction: WalletTransaction, amount: Double, balance: Double): TableRow {
        val row = TableRow(this).apply {
            layoutParams = TableLayout.LayoutParams(
                TableLayout.LayoutParams.MATCH_PARENT,
                TableLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(12, 12, 12, 12)
        }
        
        // Date & Time
        val dateText = try {
            val date = dateFormatInput.parse(transaction.date ?: "") ?: Date()
            dateFormat.format(date)
        } catch (e: Exception) {
            transaction.date ?: ""
        }
        val dateView = createTableCell(dateText, android.view.Gravity.START)
        row.addView(dateView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1.5f))
        
        // Description - clean up for Savings Recovery transactions
        var description = transaction.notes?.takeIf { it.contains("Savings Recovery", ignoreCase = true) } ?: "Loan Recovery"
        if (description.contains("Savings Recovery", ignoreCase = true)) {
            // Remove driver number and timestamp, change to "Loan Recovery"
            description = description.replace(Regex("Driver \\d+"), "")
                .replace(Regex("\\(KES [\\d.]+\\s*\\)"), "")
                .replace(Regex("- \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2} EAT"), "")
                .replace("Savings Recovery", "Loan Recovery", ignoreCase = true)
                .trim()
                .replace(Regex("\\s+"), " ") // Clean up multiple spaces
            if (description.isEmpty() || !description.contains("Loan Recovery", ignoreCase = true)) {
                description = "Loan Recovery"
            }
        }
        val descView = createTableCell(description, android.view.Gravity.START)
        row.addView(descView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 2f))
        
        // Debit (negative amounts)
        val debit = if (amount < 0) Math.abs(amount) else 0.0
        val debitView = createTableCell(currencyFormat.format(debit), android.view.Gravity.END)
        row.addView(debitView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f))
        
        // Credit (positive amounts)
        val credit = if (amount > 0) amount else 0.0
        val creditView = createTableCell(currencyFormat.format(credit), android.view.Gravity.END)
        row.addView(creditView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f))
        
        // Balance
        val balanceView = createTableCell(currencyFormat.format(balance), android.view.Gravity.END)
        row.addView(balanceView, TableRow.LayoutParams(0, TableRow.LayoutParams.WRAP_CONTENT, 1f))
        
        return row
    }
    
    private fun createTableCell(text: String, gravity: Int): TextView {
        return TextView(this).apply {
            this.text = text
            setTextColor(getColor(R.color.text_primary_dark))
            textSize = 12f
            this.gravity = gravity
            setPadding(8, 8, 8, 8)
        }
    }
    
    private fun showEmptyState(message: String) {
        binding.loadingProgress.visibility = View.GONE
        binding.swipeRefresh.isRefreshing = false
        binding.transactionsContainer.removeAllViews()
        binding.emptyStateText.text = message
        binding.emptyStateText.visibility = View.VISIBLE
    }
    
    private fun showAddLoanDialog() {
        val dialogBinding = DialogAddLoanBinding.inflate(layoutInflater)
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Add Loan")
            .setView(dialogBinding.root)
            .setNegativeButton("Cancel", null)
            .create()
        
        dialogBinding.driverEditText.setText(driverName)
        dialogBinding.driverEditText.isEnabled = false
        
        dialogBinding.submitButton.setOnClickListener {
            val amountText = dialogBinding.amountEditText.text.toString().trim()
            val reason = dialogBinding.reasonEditText.text.toString().trim()
            
            if (amountText.isEmpty()) {
                Toast.makeText(this, "Please enter loan amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            val amount = amountText.toDoubleOrNull()
            if (amount == null || amount <= 0) {
                Toast.makeText(this, "Please enter a valid loan amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            if (reason.isEmpty()) {
                Toast.makeText(this, "Please enter a reason", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            createLoan(amount, reason)
            dialog.dismiss()
        }
        
        dialog.show()
    }
    
    private fun showAddPenaltyDialog() {
        val dialogBinding = DialogAddLoanBinding.inflate(layoutInflater)
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Add Penalty")
            .setView(dialogBinding.root)
            .setNegativeButton("Cancel", null)
            .create()
        
        dialogBinding.driverEditText.setText(driverName)
        dialogBinding.driverEditText.isEnabled = false
        
        dialogBinding.submitButton.setOnClickListener {
            val amountText = dialogBinding.amountEditText.text.toString().trim()
            val reason = dialogBinding.reasonEditText.text.toString().trim()
            
            if (amountText.isEmpty()) {
                Toast.makeText(this, "Please enter penalty amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            val amount = amountText.toDoubleOrNull()
            if (amount == null || amount <= 0) {
                Toast.makeText(this, "Please enter a valid penalty amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            if (reason.isEmpty()) {
                Toast.makeText(this, "Please enter a reason", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            
            createPenalty(amount, reason)
            dialog.dismiss()
        }
        
        dialog.show()
    }
    
    private fun createLoan(amount: Double, reason: String) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@RiderDetailsActivity)
                }
                
                val request = CreateLoanRequest(driverId = driverId, amount = amount, reason = reason)
                val response = ApiClient.getApiService().createLoan(request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@RiderDetailsActivity, "Loan created successfully", Toast.LENGTH_SHORT).show()
                    loadRiderInfo()
                    loadTransactions()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "Failed to create loan. Code: ${response.code()}, Error: $errorBody")
                    Toast.makeText(this@RiderDetailsActivity, "Failed to create loan", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating loan: ${e.message}", e)
                Toast.makeText(this@RiderDetailsActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun createPenalty(amount: Double, reason: String) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@RiderDetailsActivity)
                }
                
                val request = CreateLoanRequest(driverId = driverId, amount = amount, reason = reason, type = "penalty")
                val response = ApiClient.getApiService().createLoan(request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@RiderDetailsActivity, "Penalty created successfully", Toast.LENGTH_SHORT).show()
                    loadRiderInfo()
                    loadTransactions()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "Failed to create penalty. Code: ${response.code()}, Error: $errorBody")
                    Toast.makeText(this@RiderDetailsActivity, "Failed to create penalty", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating penalty: ${e.message}", e)
                Toast.makeText(this@RiderDetailsActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
