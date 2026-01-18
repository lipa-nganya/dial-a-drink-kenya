package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.DriverWalletResponse
import com.dialadrink.driver.databinding.FragmentWalletTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class WalletTransactionsFragment : Fragment() {
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
    
    private fun loadTransactions() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getDriverWallet(driverId)
                
                if (response.isSuccessful && response.body()?.data != null) {
                    val data = response.body()!!.data!!
                    displayTransactions(data)
                } else {
                    // Extract error message from response body
                    val errorMessage = try {
                        val errorBody = response.errorBody()?.string()
                        if (!errorBody.isNullOrBlank() && !errorBody.trim().startsWith("<")) {
                            try {
                                val json = org.json.JSONObject(errorBody)
                                json.optString("error", json.optString("message", "Failed to load transactions"))
                            } catch (e: Exception) {
                                // If not JSON, check if it's ngrok error
                                if (errorBody.contains("ERR_NGROK") || errorBody.contains("offline")) {
                                    "Connection error: Backend server is offline. Please check your connection."
                                } else {
                                    errorBody.take(100) // Show first 100 chars
                                }
                            }
                        } else {
                            "Failed to load transactions (${response.code()})"
                        }
                    } catch (e: Exception) {
                        "Failed to load transactions (${response.code()})"
                    }
                    Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_LONG).show()
                    binding.emptyStateText.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                val errorMsg = if (e.message?.contains("offline") == true || e.message?.contains("ERR_NGROK") == true) {
                    "Connection error: Backend server is offline. Please check your connection."
                } else {
                    "Error: ${e.message ?: "Unknown error"}"
                }
                Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_LONG).show()
                binding.emptyStateText.visibility = View.VISIBLE
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun displayTransactions(data: DriverWalletResponse) {
        val container = binding.transactionsContainer
        container.removeAllViews()
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        val allTransactions = mutableListOf<WalletTransactionItem>()
        
        // Combine all transaction types
        data.recentTips?.forEach { tx ->
            allTransactions.add(WalletTransactionItem(
                type = "Tip",
                amount = tx.amount,
                description = tx.customerName ?: "Order #${tx.orderNumber}",
                date = tx.date,
                isPositive = true
            ))
        }
        
        data.recentDeliveryPayments?.forEach { tx ->
            allTransactions.add(WalletTransactionItem(
                type = "Delivery Pay",
                amount = tx.amount,
                description = tx.customerName ?: "Order #${tx.orderNumber}",
                date = tx.date,
                isPositive = true
            ))
        }
        
        data.cashSettlements?.forEach { tx ->
            allTransactions.add(WalletTransactionItem(
                type = "Cash Settlement",
                amount = kotlin.math.abs(tx.amount), // Cash settlements are debits, ensure positive for display
                description = tx.customerName ?: (tx.orderNumber?.let { "Order #$it" } ?: "Cash settlement"),
                date = tx.date,
                isPositive = false
            ))
        }
        
        data.recentWithdrawals?.forEach { tx ->
            allTransactions.add(WalletTransactionItem(
                type = "Withdrawal",
                amount = tx.amount,
                description = "To ${tx.phoneNumber}",
                date = tx.date,
                isPositive = false,
                status = tx.status
            ))
        }
        
        // Sort by date (newest first)
        allTransactions.sortByDescending { parseDate(it.date) }
        
        if (allTransactions.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        // Display transactions
        allTransactions.forEach { tx ->
            val cardView = LayoutInflater.from(requireContext()).inflate(
                R.layout.item_wallet_transaction,
                container,
                false
            )
            val card = cardView as MaterialCardView
            
            val typeText = card.findViewById<TextView>(R.id.typeText)
            val amountText = card.findViewById<TextView>(R.id.amountText)
            val descriptionText = card.findViewById<TextView>(R.id.descriptionText)
            val dateText = card.findViewById<TextView>(R.id.dateText)
            
            typeText.text = tx.type
            descriptionText.text = tx.description
            amountText.text = if (tx.isPositive) "+${formatter.format(tx.amount)}" else "-${formatter.format(tx.amount)}"
            amountText.setTextColor(requireContext().getColor(
                if (tx.isPositive) R.color.accent else android.R.color.holo_red_light
            ))
            
            // Format date
            try {
                val date = parseDate(tx.date)
                dateText.text = dateFormat.format(date)
            } catch (e: Exception) {
                dateText.text = tx.date
            }
            
            container.addView(card)
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
    
    private data class WalletTransactionItem(
        val type: String,
        val amount: Double,
        val description: String,
        val date: String,
        val isPositive: Boolean,
        val status: String? = null
    )
}
