package com.dialadrink.driver.ui.wallet

import android.app.AlertDialog
import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.DriverWalletResponse
import com.dialadrink.driver.data.model.SavingsWithdrawalInfo
import com.dialadrink.driver.data.model.WalletTransaction
import com.dialadrink.driver.data.model.WalletWithdrawal
import com.dialadrink.driver.data.model.WithdrawSavingsAmountOnlyRequest
import com.dialadrink.driver.databinding.FragmentSavingsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import com.google.android.material.tabs.TabLayout
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class SavingsFragment : Fragment() {
    private var _binding: FragmentSavingsBinding? = null
    private val binding get() = _binding!!
    private var savingsWithdrawalInfo: SavingsWithdrawalInfo? = null
    private var currentSavings: Double = 0.0
    private var walletData: DriverWalletResponse? = null
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSavingsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupWithdrawButton()
        setupTabs()
    }

    override fun onResume() {
        super.onResume()
        // Refresh savings balance and transaction log when returning to this screen (e.g. after Send Cash Submission)
        loadWalletData()
    }
    
    private fun setupTabs() {
        binding.savingsTabs.addTab(binding.savingsTabs.newTab().setText("Savings Transactions"))
        binding.savingsTabs.addTab(binding.savingsTabs.newTab().setText("Logs"))
        
        binding.savingsTabs.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> {
                        // Savings Transactions tab
                        binding.savingsTransactionsContainer.visibility = View.VISIBLE
                        binding.logsTableContainer.visibility = View.GONE
                        binding.logsEmptyText.visibility = View.GONE
                    }
                    1 -> {
                        // Logs tab
                        binding.savingsTransactionsContainer.visibility = View.GONE
                        binding.logsTableContainer.visibility = View.VISIBLE
                        displayLogs()
                    }
                }
            }
            
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }
    
    private fun setupWithdrawButton() {
        binding.withdrawButton.setOnClickListener {
            showWithdrawDialog()
        }
    }
    
    private fun showWithdrawDialog() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        val maxWithdraw = minOf(savingsWithdrawalInfo?.remainingDailyLimit ?: 0.0, currentSavings)
        
        if (maxWithdraw <= 0) {
            Toast.makeText(requireContext(), "No savings available to withdraw or daily limit reached", Toast.LENGTH_LONG).show()
            return
        }
        
        val dialogView = layoutInflater.inflate(R.layout.dialog_withdraw_savings, null)
        val amountInputLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.amountInputLayout)
        val amountEditText = dialogView.findViewById<EditText>(R.id.amountEditText)
        amountInputLayout.hint = "Amount (KES) — max ${String.format("%.0f", maxWithdraw)}"
        
        // Set green border color to match buttons (for all states: default, focused)
        val green = ContextCompat.getColor(requireContext(), R.color.accent)
        val colorStateList = android.content.res.ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf()
            ),
            intArrayOf(green, green)
        )
        // Use reflection to set ColorStateList for all states
        try {
            val setBoxStrokeColorStateListMethod = amountInputLayout.javaClass.getMethod(
                "setBoxStrokeColorStateList",
                android.content.res.ColorStateList::class.java
            )
            setBoxStrokeColorStateListMethod.invoke(amountInputLayout, colorStateList)
        } catch (e: Exception) {
            // Fallback to direct property if reflection fails
            amountInputLayout.boxStrokeColor = green
        }
        
        val dialog = AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Withdraw Savings")
            .setView(dialogView)
            .setPositiveButton("Withdraw") { _, _ ->
                val amountText = amountEditText.text.toString().trim()
                
                if (amountText.isBlank()) {
                    Toast.makeText(requireContext(), "Please enter amount", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                
                val amount = amountText.toDoubleOrNull()
                if (amount == null || amount <= 0) {
                    Toast.makeText(requireContext(), "Please enter a valid amount", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                
                if (amount > maxWithdraw) {
                    Toast.makeText(requireContext(), "Amount exceeds available limit (KES ${String.format("%.2f", maxWithdraw)})", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }
                
                withdrawSavings(driverId, amount)
            }
            .setNegativeButton("Cancel", null)
            .create()
        
        // Apply styling after dialog is created but before showing
        dialog.setOnShowListener {
            val green = ContextCompat.getColor(requireContext(), R.color.accent)
            val white = ContextCompat.getColor(requireContext(), R.color.text_primary_dark)
            
            // Style title
            val titleView = dialog.findViewById<android.widget.TextView>(android.R.id.title)
            titleView?.setTextColor(white)
            
            // Style buttons
            dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.apply {
                setTextColor(green)
                setBackgroundResource(R.drawable.button_border_green)
            }
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.apply {
                setTextColor(green)
                setBackgroundResource(R.drawable.button_border_green)
            }
        }
        
        dialog.show()
    }
    
    private fun withdrawSavings(driverId: Int, amount: Double) {
        binding.loadingProgress.visibility = View.VISIBLE
        binding.withdrawButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                val request = WithdrawSavingsAmountOnlyRequest(amount = amount)
                val response = ApiClient.getApiService().withdrawSavingsAmountOnly(driverId, request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()!!.data!!
                    Toast.makeText(requireContext(), "Withdrawal initiated successfully. ${data.note}", Toast.LENGTH_LONG).show()
                    // Refresh data and show withdrawal in transactions
                    loadWalletData()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMessage = try {
                        if (errorBody != null && errorBody.isNotBlank() && !errorBody.trim().startsWith("<")) {
                            val json = org.json.JSONObject(errorBody)
                            json.optString("error", json.optString("message", "Failed to withdraw savings"))
                        } else {
                            "Failed to withdraw savings: ${response.code()}"
                        }
                    } catch (e: Exception) {
                        "Failed to withdraw savings: ${response.code()}"
                    }
                    Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.withdrawButton.isEnabled = true
            }
        }
    }
    
    private fun loadWalletData() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getDriverWallet(driverId)
                
                if (response.isSuccessful && response.body()?.data != null) {
                    val data = response.body()!!.data!!
                    walletData = data
                    displayWallet(data)
                } else {
                    // Extract error message from response body
                    val errorMessage = try {
                        val errorBody = response.errorBody()?.string()
                        if (!errorBody.isNullOrBlank() && !errorBody.trim().startsWith("<")) {
                            try {
                                val json = org.json.JSONObject(errorBody)
                                json.optString("error", json.optString("message", "Failed to load wallet"))
                            } catch (e: Exception) {
                                // If not JSON, check if it's ngrok error
                                if (errorBody.contains("ERR_NGROK") || errorBody.contains("offline")) {
                                    "Connection error: Backend server is offline. Please check your connection."
                                } else {
                                    errorBody.take(100) // Show first 100 chars
                                }
                            }
                        } else {
                            "Failed to load wallet (${response.code()})"
                        }
                    } catch (e: Exception) {
                        "Failed to load wallet (${response.code()})"
                    }
                    Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                val errorMsg = if (e.message?.contains("offline") == true || e.message?.contains("ERR_NGROK") == true) {
                    "Connection error: Backend server is offline. Please check your connection."
                } else {
                    "Error: ${e.message ?: "Unknown error"}"
                }
                Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_LONG).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val dateFormatShort = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val apiDateFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }

    private fun displayWallet(data: DriverWalletResponse) {
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        val wallet = data.wallet
        
        // Display savings
        currentSavings = wallet.savings ?: 0.0
        binding.savingsText.text = formatter.format(currentSavings)
        
        // Get savings withdrawal info from response
        savingsWithdrawalInfo = data.savingsWithdrawal
        if (savingsWithdrawalInfo != null) {
            val remaining = savingsWithdrawalInfo!!.remainingDailyLimit
            if (remaining < 1000.0) {
                binding.remainingLimitText.text = "Remaining today: ${formatter.format(remaining)}"
                binding.remainingLimitText.visibility = View.VISIBLE
            } else {
                binding.remainingLimitText.visibility = View.GONE
            }
            
            // Enable/disable withdraw button
            binding.withdrawButton.isEnabled = savingsWithdrawalInfo!!.canWithdraw && currentSavings > 0
        } else {
            // Fallback: assume can withdraw if savings > 0
            binding.withdrawButton.isEnabled = currentSavings > 0
        }

        // Display savings transactions (credits from orders and withdrawals)
        displaySavingsTransactions(data)
    }

    private fun displaySavingsTransactions(data: DriverWalletResponse) {
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        binding.savingsCreditsContainer.removeAllViews()
        
        // Get credits (from orders) and withdrawals
        val credits = data.recentSavingsCredits.orEmpty()
        // Filter withdrawals - check if they're savings-related
        // Savings withdrawals typically have notes mentioning "savings" or are from savings withdrawal endpoint
        val withdrawals = data.recentWithdrawals.orEmpty()
            .filter { 
                val notes = it.notes?.lowercase() ?: ""
                notes.contains("savings", ignoreCase = true) || 
                notes.contains("withdraw savings", ignoreCase = true) ||
                // If no specific note, we'll include all withdrawals for now (can be refined based on API)
                (it.notes == null && data.recentWithdrawals?.size == 1)
            }
        
        // Combine and sort by date (newest first)
        val allTransactions = mutableListOf<Pair<String, Any>>()
        credits.forEach { tx ->
            allTransactions.add(Pair("credit", tx))
        }
        withdrawals.forEach { wd ->
            allTransactions.add(Pair("withdrawal", wd))
        }
        
        val sortedTransactions = allTransactions.sortedByDescending { (type, tx) ->
            when (type) {
                "credit" -> parseDate((tx as WalletTransaction).date).time
                "withdrawal" -> parseDate((tx as WalletWithdrawal).date).time
                else -> 0L
            }
        }
        
        if (sortedTransactions.isEmpty()) {
            binding.savingsCreditsContainer.visibility = View.GONE
            binding.savingsEmptyText.visibility = View.VISIBLE
        } else {
            binding.savingsEmptyText.visibility = View.GONE
            binding.savingsCreditsContainer.visibility = View.VISIBLE
            
            sortedTransactions.forEach { (type, tx) ->
                val cardView = LayoutInflater.from(requireContext()).inflate(
                    R.layout.item_wallet_transaction,
                    binding.savingsCreditsContainer,
                    false
                ) as MaterialCardView
                
                when (type) {
                    "credit" -> {
                        val creditTx = tx as WalletTransaction
                        val orderInfo = buildString {
                            creditTx.orderLocation?.takeIf { it.isNotBlank() }?.let { loc ->
                                append("$loc")
                            }
                            append(" · Delivery fee (50% to savings): ${formatter.format(creditTx.amount)}")
                        }
                        cardView.findViewById<TextView>(R.id.typeText).text = "Order #${creditTx.orderNumber ?: creditTx.orderId ?: ""}"
                        cardView.findViewById<TextView>(R.id.amountText).text = "+${formatter.format(creditTx.amount)}"
                        cardView.findViewById<TextView>(R.id.amountText).setTextColor(ContextCompat.getColor(requireContext(), R.color.accent))
                        cardView.findViewById<TextView>(R.id.descriptionText).text = orderInfo
                        try {
                            cardView.findViewById<TextView>(R.id.dateText).text = dateFormat.format(parseDate(creditTx.date))
                        } catch (e: Exception) {
                            cardView.findViewById<TextView>(R.id.dateText).text = creditTx.date
                        }
                    }
                    "withdrawal" -> {
                        val withdrawalTx = tx as WalletWithdrawal
                        cardView.findViewById<TextView>(R.id.typeText).text = "Withdrawal"
                        cardView.findViewById<TextView>(R.id.amountText).text = "-${formatter.format(withdrawalTx.amount)}"
                        cardView.findViewById<TextView>(R.id.amountText).setTextColor(ContextCompat.getColor(requireContext(), R.color.text_primary_dark))
                        cardView.findViewById<TextView>(R.id.descriptionText).text = withdrawalTx.notes ?: "Savings withdrawal"
                        try {
                            cardView.findViewById<TextView>(R.id.dateText).text = dateFormat.format(parseDate(withdrawalTx.date))
                        } catch (e: Exception) {
                            cardView.findViewById<TextView>(R.id.dateText).text = withdrawalTx.date
                        }
                    }
                }
                binding.savingsCreditsContainer.addView(cardView)
            }
        }
    }
    
    private fun displayLogs() {
        val data = walletData ?: return
        val formatter = NumberFormat.getNumberInstance(Locale("en", "KE")).apply {
            minimumFractionDigits = 0
            maximumFractionDigits = 0
        }
        
        val tableLayout = binding.logsTable
        tableLayout.removeAllViews()
        
        // Get all transactions (credits and withdrawals) for logs
        val credits = data.recentSavingsCredits.orEmpty()
        // Include all withdrawals in logs - since we're on the Savings page, 
        // all withdrawals shown here should be savings-related
        val withdrawals = data.recentWithdrawals.orEmpty()
        
        // Combine and sort by date (newest first)
        val allTransactions = mutableListOf<Pair<String, Any>>()
        credits.forEach { tx ->
            allTransactions.add(Pair("credit", tx))
        }
        withdrawals.forEach { wd ->
            allTransactions.add(Pair("withdrawal", wd))
        }
        
        val sortedTransactions = allTransactions.sortedByDescending { (type, tx) ->
            when (type) {
                "credit" -> parseDate((tx as WalletTransaction).date).time
                "withdrawal" -> parseDate((tx as WalletWithdrawal).date).time
                else -> 0L
            }
        }
        
        if (sortedTransactions.isEmpty()) {
            binding.logsTableContainer.visibility = View.GONE
            binding.logsEmptyText.visibility = View.VISIBLE
            return
        }
        
        binding.logsEmptyText.visibility = View.GONE
        binding.logsTableContainer.visibility = View.VISIBLE
        
        // Calculate running balance - start from current savings and work backwards
        // Since we're displaying newest first, we need to calculate balance before each transaction
        var balanceAfter = currentSavings
        
        sortedTransactions.forEach { (type, tx) ->
            val row = LayoutInflater.from(requireContext()).inflate(
                R.layout.item_cash_transaction_row,
                tableLayout,
                false
            ) as TableRow
            
            val deliveryAddressText = row.findViewById<TextView>(R.id.deliveryAddressText)
            val dateText = row.findViewById<TextView>(R.id.dateText)
            val debitText = row.findViewById<TextView>(R.id.debitText)
            val creditText = row.findViewById<TextView>(R.id.creditText)
            val balanceText = row.findViewById<TextView>(R.id.balanceText)
            
            when (type) {
                "credit" -> {
                    val creditTx = tx as WalletTransaction
                    val address = creditTx.orderLocation ?: creditTx.customerName ?: "N/A"
                    deliveryAddressText.text = address
                    
                    try {
                        val date = parseDate(creditTx.date)
                        dateText.text = dateFormatShort.format(date)
                    } catch (e: Exception) {
                        dateText.text = creditTx.date.substring(0, 10).takeIf { creditTx.date.length >= 10 } ?: creditTx.date
                    }
                    
                    // Credit transaction (money in, increases savings) = Credit column
                    debitText.text = "0"
                    creditText.text = formatter.format(creditTx.amount)
                    balanceText.text = formatter.format(balanceAfter)
                    // Balance before this transaction = balance after - amount
                    balanceAfter -= creditTx.amount
                }
                "withdrawal" -> {
                    val withdrawalTx = tx as WalletWithdrawal
                    deliveryAddressText.text = "Withdrawal"
                    
                    try {
                        val date = parseDate(withdrawalTx.date)
                        dateText.text = dateFormatShort.format(date)
                    } catch (e: Exception) {
                        dateText.text = withdrawalTx.date.substring(0, 10).takeIf { withdrawalTx.date.length >= 10 } ?: withdrawalTx.date
                    }
                    
                    // Withdrawal transaction (money out, decreases savings) = Debit column
                    debitText.text = formatter.format(withdrawalTx.amount)
                    creditText.text = "0"
                    balanceText.text = formatter.format(balanceAfter)
                    // Balance before this transaction = balance after + amount
                    balanceAfter += withdrawalTx.amount
                }
            }
            
            tableLayout.addView(row)
        }
    }
    
    private fun parseDate(dateString: String): Date {
        return try {
            apiDateFormat.parse(dateString) ?: apiDateFormat2.parse(dateString) ?: Date()
        } catch (e: Exception) {
            try {
                apiDateFormat2.parse(dateString) ?: Date()
            } catch (e2: Exception) {
                Date()
            }
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
