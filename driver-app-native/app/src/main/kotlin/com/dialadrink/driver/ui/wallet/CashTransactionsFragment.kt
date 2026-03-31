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
import com.dialadrink.driver.data.model.CashAtHandEntry
import com.dialadrink.driver.data.model.CashAtHandResponse
import com.dialadrink.driver.databinding.FragmentWalletTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.*

class CashTransactionsFragment : Fragment() {
    private var _binding: FragmentWalletTransactionsBinding? = null
    private val binding get() = _binding!!
    
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
        isLenient = false
    }
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
        isLenient = false
    }
    private val apiDateFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
        isLenient = false
    }
    private val displayGroupDateFormat = SimpleDateFormat("EEEE, MMM d, yyyy", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
        isLenient = false
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
        binding.fixedHeaderCard.visibility = View.GONE
        
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
        // Hide container, show table
        binding.transactionsContainer.visibility = View.GONE
        val tableContainer = binding.root.findViewById<View>(R.id.tableContainer)
        tableContainer?.visibility = View.VISIBLE
        binding.fixedHeaderCard.visibility = View.VISIBLE
        binding.tableHeaderRow.visibility = View.GONE
        
        val tableLayout = binding.transactionsTable
        tableLayout.removeAllViews()
        
        val formatter = NumberFormat.getNumberInstance(Locale("en", "KE")).apply {
            minimumFractionDigits = 0
            maximumFractionDigits = 0
        }
        
        // Current cash at hand is already shown above the Transactions | Logs tabs.
        
        if (data.entries.isEmpty()) {
            binding.fixedHeaderCard.visibility = View.GONE
            binding.emptyStateText.visibility = View.VISIBLE
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        // Sort entries by date descending (newest first), then stable tie-breakers (matches backend)
        val sortedEntries = data.entries.sortedWith(
            compareByDescending<CashAtHandEntry> {
                try {
                    parseApiDate(it.date)?.time ?: 0L
                } catch (_: Exception) {
                    0L
                }
            }.thenByDescending { it.orderId ?: 0 }
                .thenByDescending { it.transactionId ?: 0 }
        )

        // Calculate running balance backwards from current total (since we're displaying newest first)
        // Start with current balance - this is the balance after the newest transaction
        var balanceAfter = data.totalCashAtHand
        var lastGroupDate: String? = null

        // Keep first group comfortably below fixed header.
        // Use measured header height (when available) so we don't overlap on different devices.
        val fixedHeaderHeightPx = binding.fixedHeaderCard.height.takeIf { it > 0 } ?: 72
        val spacerHeightPx = (fixedHeaderHeightPx + 24).coerceAtLeast(88)
        val topSpacerRow = TableRow(requireContext()).apply { minimumHeight = spacerHeightPx }
        tableLayout.addView(topSpacerRow)
        
        sortedEntries.forEach { entry ->
            val groupDate = try {
                val date = parseApiDate(entry.date)
                date?.let { dateFormat.format(it) } ?: "Unknown Date"
            } catch (e: Exception) {
                "Unknown Date"
            }

            if (lastGroupDate != groupDate) {
                val groupRow = TableRow(requireContext()).apply {
                    setPadding(0, 2, 0, 0)
                }
                val groupLabel = TextView(requireContext()).apply {
                    layoutParams = TableRow.LayoutParams(
                        TableRow.LayoutParams.MATCH_PARENT,
                        TableRow.LayoutParams.WRAP_CONTENT
                    )
                    text = formatGroupDateForDisplay(groupDate)
                    textSize = 12f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    setTextColor(requireContext().getColor(R.color.accent))
                    setPadding(16, 4, 16, 2)
                }
                groupRow.addView(groupLabel)
                tableLayout.addView(groupRow)
                lastGroupDate = groupDate
            }

            val row = LayoutInflater.from(requireContext()).inflate(
                R.layout.item_cash_at_hand_log_row,
                tableLayout,
                false
            ) as TableRow
            
            val deliveryAddressText = row.findViewById<TextView>(R.id.deliveryAddressText)
            val debitText = row.findViewById<TextView>(R.id.debitText)
            val creditText = row.findViewById<TextView>(R.id.creditText)
            val balanceText = row.findViewById<TextView>(R.id.balanceText)
            
            // Extract delivery address from description
            // Description format might be: "Cash received for Order #123 - [Address]" or similar
            val deliveryAddress = extractDeliveryAddress(entry.description, entry.customerName)
            val deliveryAddressForRow = if (entry.type == "cash_submission") {
                val base = deliveryAddress.trim()
                if (base.isEmpty()) {
                    "submission"
                } else if (base.lowercase(Locale.getDefault()).endsWith("submission")) {
                    base
                } else {
                    "$base submission"
                }
            } else {
                deliveryAddress
            }
            deliveryAddressText.text = formatDescriptionWithOrderNumber(entry.orderId, deliveryAddressForRow)
            
            when (entry.type) {
                "cash_received" -> {
                    // DBT = 50% territory withheld, CRT = full order value (net cash at hand += CRT - DBT)
                    val territoryHalf = entry.debitAmount
                        ?: (entry.deliveryFee?.let { it * 0.5 })
                    val fullOrder = entry.creditAmount ?: entry.orderValue
                        ?: (entry.deliveryFee?.let { entry.amount + it * 0.5 })
                    debitText.text = territoryHalf?.let { formatter.format(it) } ?: "0"
                    creditText.text = fullOrder?.let { formatter.format(it) } ?: formatter.format(entry.amount)
                    balanceText.text = formatter.format(balanceAfter)
                    balanceAfter -= entry.amount
                }
                "cash_submission" -> {
                    // Submissions reduce cash at hand (debit)
                    debitText.text = formatter.format(entry.amount)
                    creditText.text = "0"
                    balanceText.text = formatter.format(balanceAfter)
                    balanceAfter += entry.amount
                }
                else -> {
                    // cash_sent and any other outflows: money leaving cash at hand
                    debitText.text = formatter.format(entry.amount)
                    creditText.text = "0"
                    balanceText.text = formatter.format(balanceAfter)
                    balanceAfter += entry.amount
                }
            }
            
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

    private fun formatDescriptionWithOrderNumber(orderId: Int?, description: String): String {
        if (orderId == null) return description
        val cleaned = description.trim()
        return if (cleaned.isEmpty()) {
            "#$orderId"
        } else {
            "#$orderId • $cleaned"
        }
    }

    private fun formatGroupDateForDisplay(groupDate: String): String {
        if (groupDate == "Unknown Date") return groupDate
        return try {
            val parsed = dateFormat.parse(groupDate)
            if (parsed != null) displayGroupDateFormat.format(parsed) else groupDate
        } catch (e: Exception) {
            groupDate
        }
    }

    private fun parseApiDate(raw: String?): Date? {
        if (raw.isNullOrBlank()) return null
        val value = raw.trim()
        val parsed = try {
            apiDateFormat.parse(value)
        } catch (_: Exception) {
            try {
                apiDateFormat2.parse(value)
            } catch (_: Exception) {
                try {
                    SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSSXXX", Locale.getDefault()).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                        isLenient = false
                    }.parse(value)
                } catch (_: Exception) {
                    try {
                        SimpleDateFormat("yyyy-MM-dd HH:mm:ssXXX", Locale.getDefault()).apply {
                            timeZone = TimeZone.getTimeZone("UTC")
                            isLenient = false
                        }.parse(value)
                    } catch (_: Exception) {
                        null
                    }
                }
            }
        }
        if (parsed == null) return null
        val year = Calendar.getInstance().apply { time = parsed }.get(Calendar.YEAR)
        return if (year in 2000..2100) parsed else null
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
