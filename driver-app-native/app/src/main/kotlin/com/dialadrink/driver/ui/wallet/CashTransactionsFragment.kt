package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TableLayout
import android.widget.TableRow
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.CashAtHandResponse
import com.dialadrink.driver.databinding.FragmentWalletTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class CashTransactionsFragment : Fragment() {
    private var _binding: FragmentWalletTransactionsBinding? = null
    private val binding get() = _binding!!
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val apiDateFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentWalletTransactionsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadTransactions()
    }
    
    fun refresh() {
        loadTransactions()
    }
    
    private fun loadTransactions() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCashAtHand(driverId)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null) {
                        displayTransactions(data)
                    } else {
                        binding.emptyStateText.visibility = View.VISIBLE
                    }
                } else {
                    binding.emptyStateText.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.emptyStateText.visibility = View.VISIBLE
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun displayTransactions(data: CashAtHandResponse) {
        // Hide container, show table and balance card
        binding.transactionsContainer.visibility = View.GONE
        val tableContainer = binding.root.findViewById<View>(R.id.tableContainer)
        tableContainer?.visibility = View.VISIBLE
        
        // Show balance card
        val balanceCard = binding.root.findViewById<View>(R.id.balanceCard)
        balanceCard?.visibility = View.VISIBLE
        
        val tableLayout = binding.transactionsTable
        tableLayout.removeAllViews()
        
        val formatter = NumberFormat.getNumberInstance(Locale("en", "KE")).apply {
            minimumFractionDigits = 0
            maximumFractionDigits = 0
        }
        
        // Display current balance at the top
        val currentBalanceText = binding.root.findViewById<TextView>(R.id.currentBalanceText)
        if (currentBalanceText != null) {
            val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
            currentBalanceText.text = currencyFormatter.format(data.totalCashAtHand)
        }
        
        if (data.entries.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        // Sort entries by date ascending (oldest first) for balance sheet format
        val sortedEntries = data.entries.sortedBy { entry ->
            try {
                val date = try {
                    apiDateFormat.parse(entry.date)
                } catch (e: Exception) {
                    apiDateFormat2.parse(entry.date)
                }
                date?.time ?: 0L
            } catch (e: Exception) {
                0L
            }
        }
        
        // Calculate initial balance (balance before first transaction)
        // Work backwards from current balance
        var initialBalance = data.totalCashAtHand
        sortedEntries.reversed().forEach { entry ->
            if (entry.type == "cash_received") {
                initialBalance -= entry.amount
            } else {
                initialBalance += entry.amount
            }
        }
        
        // Now calculate running balance forward from initial balance
        var runningBalance = initialBalance
        
        sortedEntries.forEach { entry ->
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
            
            // Extract delivery address from description
            // Description format might be: "Cash received for Order #123 - [Address]" or similar
            val deliveryAddress = extractDeliveryAddress(entry.description, entry.customerName)
            deliveryAddressText.text = deliveryAddress
            
            // Format date as YYYY-MM-DD
            try {
                val date = try {
                    apiDateFormat.parse(entry.date)
                } catch (e: Exception) {
                    apiDateFormat2.parse(entry.date)
                }
                dateText.text = date?.let { dateFormat.format(it) } ?: entry.date.substring(0, 10).takeIf { entry.date.length >= 10 } ?: entry.date
            } catch (e: Exception) {
                // Try to extract date part if full date string
                dateText.text = entry.date.substring(0, 10).takeIf { entry.date.length >= 10 } ?: entry.date
            }
            
            // Set debit/credit amounts
            if (entry.type == "cash_received") {
                // Cash received = Debit (increases balance)
                debitText.text = formatter.format(entry.amount)
                creditText.text = "0"
                runningBalance += entry.amount
            } else {
                // Cash sent = Credit (decreases balance)
                debitText.text = "0"
                creditText.text = formatter.format(entry.amount)
                runningBalance -= entry.amount
            }
            
            // Display balance after this transaction
            balanceText.text = formatter.format(runningBalance)
            
            tableLayout.addView(row)
        }
    }
    
    private fun extractDeliveryAddress(description: String, customerName: String?): String {
        // Try to extract address from description
        // Common patterns:
        // - "Cash received for Order #123 - [Address]"
        // - "Cash received - [Address]"
        // - Description might already be the address
        
        // If description contains " - ", take the part after it
        val parts = description.split(" - ")
        if (parts.size > 1) {
            return parts.last().trim()
        }
        
        // If description contains "Order #", try to extract address
        val orderIndex = description.indexOf("Order #")
        if (orderIndex != -1) {
            val afterOrder = description.substring(orderIndex)
            val dashIndex = afterOrder.indexOf(" - ")
            if (dashIndex != -1) {
                return afterOrder.substring(dashIndex + 3).trim()
            }
        }
        
        // If customer name is available and description is generic, use description
        if (customerName != null && (description.contains("Cash received") || description.contains("Cash sent"))) {
            return description.replace("Cash received for ", "")
                .replace("Cash received - ", "")
                .replace("Cash sent for ", "")
                .replace("Cash sent - ", "")
                .trim()
        }
        
        // Fallback to description or customer name
        return description.ifEmpty { customerName ?: "N/A" }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
