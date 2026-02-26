package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.CashAtHandEntry
import com.dialadrink.driver.data.model.CashAtHandResponse
import com.dialadrink.driver.databinding.FragmentWalletTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

/**
 * Fragment to display all cash at hand transactions (credits/debits)
 * Similar to Savings Transactions tab - shows all transactions affecting cash at hand balance
 */
class CashAtHandTransactionsFragment : Fragment() {
    private var _binding: FragmentWalletTransactionsBinding? = null
    private val binding get() = _binding!!
    
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).apply {
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
                        showEmptyState()
                    }
                } else {
                    showEmptyState()
                }
            } catch (e: Exception) {
                showEmptyState()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun displayTransactions(data: CashAtHandResponse) {
        // Hide table container, show transactions container
        binding.tableContainer.visibility = View.GONE
        binding.transactionsContainer.visibility = View.VISIBLE
        binding.transactionsContainer.removeAllViews()
        
        if (data.entries.isEmpty()) {
            showEmptyState()
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        
        // Sort entries by date descending (newest first)
        val sortedEntries = data.entries.sortedByDescending { entry ->
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
        
        sortedEntries.forEach { entry ->
            val cardView = LayoutInflater.from(requireContext()).inflate(
                R.layout.item_wallet_transaction,
                binding.transactionsContainer,
                false
            ) as MaterialCardView
            
            // Extract order number from description or use orderId
            val orderNumber = extractOrderNumber(entry.description, entry.orderId)
            
            // Build type text
            val typeText = if (orderNumber != null) {
                "Order #$orderNumber"
            } else {
                when (entry.type) {
                    "cash_received" -> "Cash Received"
                    "cash_sent" -> "Cash Sent"
                    else -> "Transaction"
                }
            }
            
            // Build description with location and customer info
            val descriptionText = buildDescription(entry)
            
            // Set card content
            cardView.findViewById<TextView>(R.id.typeText).text = typeText
            cardView.findViewById<TextView>(R.id.amountText).text = if (entry.type == "cash_received") {
                "+${formatter.format(entry.amount)}"
            } else {
                "-${formatter.format(entry.amount)}"
            }
            cardView.findViewById<TextView>(R.id.amountText).setTextColor(
                if (entry.type == "cash_received") {
                    ContextCompat.getColor(requireContext(), R.color.accent)
                } else {
                    ContextCompat.getColor(requireContext(), R.color.text_primary_dark)
                }
            )
            cardView.findViewById<TextView>(R.id.descriptionText).text = descriptionText
            
            // Format and set date
            try {
                val date = try {
                    apiDateFormat.parse(entry.date)
                } catch (e: Exception) {
                    apiDateFormat2.parse(entry.date)
                }
                cardView.findViewById<TextView>(R.id.dateText).text = date?.let { dateFormat.format(it) } ?: entry.date
            } catch (e: Exception) {
                cardView.findViewById<TextView>(R.id.dateText).text = entry.date
            }
            
            binding.transactionsContainer.addView(cardView)
        }
    }
    
    private fun extractOrderNumber(description: String?, orderId: Int?): Int? {
        // Try to extract order number from description
        // Common patterns: "Order #123", "Order 123", "for Order #123"
        if (description != null) {
            val orderPattern = Regex("Order\\s*#?\\s*(\\d+)", RegexOption.IGNORE_CASE)
            val match = orderPattern.find(description)
            if (match != null) {
                return match.groupValues[1].toIntOrNull()
            }
        }
        // Fallback to orderId
        return orderId
    }
    
    private fun buildDescription(entry: CashAtHandEntry): String {
        val parts = mutableListOf<String>()
        
        // Extract location from description if available
        val location = extractLocation(entry.description)
        if (location != null) {
            parts.add(location)
        }
        
        // Add customer name if available
        if (entry.customerName != null && entry.customerName.isNotBlank()) {
            parts.add(entry.customerName)
        }
        
        // Add transaction type description
        when (entry.type) {
            "cash_received" -> {
                if (entry.orderId != null) {
                    parts.add("Cash received for delivery")
                } else {
                    parts.add("Cash received")
                }
            }
            "cash_sent" -> {
                if (entry.orderId != null) {
                    parts.add("Cash submitted for order")
                } else {
                    parts.add("Cash submitted")
                }
            }
        }
        
        // If description has additional info, add it
        if (entry.description != null && entry.description.isNotBlank()) {
            // Remove order number pattern from description to avoid duplication
            val cleanDescription = entry.description.replace(Regex("Order\\s*#?\\s*\\d+", RegexOption.IGNORE_CASE), "").trim()
            if (cleanDescription.isNotBlank() && !parts.contains(cleanDescription)) {
                // Only add if it's not already covered by location/customer name
                val isAlreadyCovered = location != null && cleanDescription.contains(location, ignoreCase = true)
                if (!isAlreadyCovered) {
                    parts.add(cleanDescription)
                }
            }
        }
        
        return if (parts.isEmpty()) {
            entry.description ?: "Cash at hand transaction"
        } else {
            parts.joinToString(" · ")
        }
    }
    
    private fun extractLocation(description: String?): String? {
        if (description == null) return null
        
        // Try to extract location from patterns like:
        // "Cash received for Order #123 - [Location]"
        // "Cash received - [Location]"
        val locationPattern = Regex("(?:-|–|—)\\s*(.+?)(?:\\s*·|$)", RegexOption.IGNORE_CASE)
        val match = locationPattern.find(description)
        if (match != null) {
            val location = match.groupValues[1].trim()
            // Don't return if it looks like it contains order info
            if (!location.contains("Order", ignoreCase = true) && location.length > 3) {
                return location
            }
        }
        
        // Try to find location after "Order #XXX"
        val orderLocationPattern = Regex("Order\\s*#?\\s*\\d+\\s*-\\s*(.+?)(?:\\s*·|$)", RegexOption.IGNORE_CASE)
        val orderMatch = orderLocationPattern.find(description)
        if (orderMatch != null) {
            val location = orderMatch.groupValues[1].trim()
            if (location.length > 3) {
                return location
            }
        }
        
        return null
    }
    
    private fun showEmptyState() {
        binding.transactionsContainer.visibility = View.GONE
        binding.emptyStateText.visibility = View.VISIBLE
        binding.emptyStateText.text = "No transactions"
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
