package com.dialadrink.driver.ui.wallet

import android.app.DatePickerDialog
import android.app.AlertDialog
import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.DriverWalletResponse
import com.dialadrink.driver.data.model.WithdrawSavingsRequest
import com.dialadrink.driver.data.model.WithdrawWalletResponse
import com.dialadrink.driver.databinding.FragmentWalletBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class WalletFragment : Fragment() {
    private var _binding: FragmentWalletBinding? = null
    private val binding get() = _binding!!
    
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val displayDateFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val apiDateFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    private var allTransactions = mutableListOf<WalletTransactionItem>()
    private var filteredTransactions = mutableListOf<WalletTransactionItem>()
    private var currentPage = 1
    private val itemsPerPage = 7
    
    private var startDate: Date? = null
    private var endDate: Date? = null
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentWalletBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupWithdrawButton()
        setupDateFilters()
        setupPagination()
        loadWalletData()
    }
    
    private fun setupWithdrawButton() {
        binding.withdrawButton.setOnClickListener {
            showWithdrawDialog()
        }
    }
    
    private fun setupDateFilters() {
        binding.startDateButton.setOnClickListener {
            showDatePicker(true)
        }
        
        binding.endDateButton.setOnClickListener {
            showDatePicker(false)
        }
        
        binding.clearFilterButton.setOnClickListener {
            startDate = null
            endDate = null
            binding.startDateButton.text = "Start Date"
            binding.endDateButton.text = "End Date"
            applyFilters()
        }
    }
    
    private fun setupPagination() {
        binding.prevPageButton.setOnClickListener {
            if (currentPage > 1) {
                currentPage--
                displayCurrentPage()
            }
        }
        
        binding.nextPageButton.setOnClickListener {
            val totalPages = getTotalPages()
            if (currentPage < totalPages) {
                currentPage++
                displayCurrentPage()
            }
        }
    }
    
    private fun showDatePicker(isStartDate: Boolean) {
        val calendar = Calendar.getInstance()
        val initialDate = if (isStartDate) {
            startDate ?: Date()
        } else {
            endDate ?: Date()
        }
        calendar.time = initialDate
        
        val datePicker = DatePickerDialog(
            requireContext(),
            R.style.Theme_DialADrinkDriver_DatePickerDialog,
            { _, year, month, dayOfMonth ->
                val selectedDate = Calendar.getInstance().apply {
                    set(year, month, dayOfMonth)
                    set(Calendar.HOUR_OF_DAY, if (isStartDate) 0 else 23)
                    set(Calendar.MINUTE, if (isStartDate) 0 else 59)
                    set(Calendar.SECOND, if (isStartDate) 0 else 59)
                }.time
                
                if (isStartDate) {
                    startDate = selectedDate
                    binding.startDateButton.text = displayDateFormat.format(selectedDate)
                } else {
                    endDate = selectedDate
                    binding.endDateButton.text = displayDateFormat.format(selectedDate)
                }
                
                // Validate date range
                if (startDate != null && endDate != null && startDate!!.after(endDate)) {
                    Toast.makeText(requireContext(), "Start date must be before end date", Toast.LENGTH_SHORT).show()
                    if (isStartDate) {
                        startDate = null
                        binding.startDateButton.text = "Start Date"
                    } else {
                        endDate = null
                        binding.endDateButton.text = "End Date"
                    }
                    return@DatePickerDialog
                }
                
                applyFilters()
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        )
        datePicker.show()
    }
    
    private fun applyFilters() {
        filteredTransactions = allTransactions.filter { tx ->
            val txDate = parseDate(tx.date)
            val afterStart = startDate == null || !txDate.before(startDate)
            val beforeEnd = endDate == null || !txDate.after(endDate)
            afterStart && beforeEnd
        }.toMutableList()
        
        currentPage = 1
        displayCurrentPage()
    }
    
    private fun showWithdrawDialog() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        val driverPhone = SharedPrefs.getDriverPhone(requireContext()) ?: ""
        val currentBalance = binding.balanceText.text.toString()
            .replace("KES ", "")
            .replace(",", "")
            .toDoubleOrNull() ?: 0.0
        
        if (currentBalance <= 0) {
            Toast.makeText(requireContext(), "No wallet balance available to withdraw", Toast.LENGTH_LONG).show()
            return
        }
        
        val dialogView = layoutInflater.inflate(R.layout.dialog_withdraw_savings, null)
        val amountInputLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.amountInputLayout)
        val amountEditText = dialogView.findViewById<EditText>(R.id.amountEditText)
        amountInputLayout?.hint = "Amount (KES) — max ${String.format("%.0f", currentBalance)}"
        
        AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Withdraw Wallet Balance")
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
                
                if (amount > currentBalance) {
                    Toast.makeText(requireContext(), "Amount exceeds available balance (KES ${String.format("%.2f", currentBalance)})", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }
                
                withdrawWallet(driverId, amount, driverPhone.ifBlank { "" })
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun withdrawWallet(driverId: Int, amount: Double, phoneNumber: String) {
        binding.loadingProgress.visibility = View.VISIBLE
        binding.withdrawButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                // Use the same request model as savings withdrawal
                val request = WithdrawSavingsRequest(amount = amount, phoneNumber = phoneNumber)
                val response = ApiClient.getApiService().withdrawWallet(driverId, request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()!!.data!!
                    Toast.makeText(requireContext(), "Withdrawal initiated successfully. ${data.note}", Toast.LENGTH_LONG).show()
                    loadWalletData() // Refresh data
                } else {
                    val errorBody = response.errorBody()?.string()
                    val errorMessage = try {
                        if (errorBody != null && errorBody.isNotBlank() && !errorBody.trim().startsWith("<")) {
                            val json = org.json.JSONObject(errorBody)
                            json.optString("error", json.optString("message", "Failed to withdraw wallet balance"))
                        } else {
                            "Failed to withdraw wallet balance: ${response.code()}"
                        }
                    } catch (e: Exception) {
                        "Failed to withdraw wallet balance: ${response.code()}"
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
    
    private fun displayWallet(data: DriverWalletResponse) {
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        val wallet = data.wallet
        
        // Display total wallet balance (50% Delivery Fee for Pay Now orders)
        val totalBalance = wallet.availableBalance ?: wallet.balance
        binding.balanceText.text = formatter.format(totalBalance)
        
        // Enable/disable withdraw button based on balance
        binding.withdrawButton.isEnabled = totalBalance > 0
        
        // Load and display wallet transactions (delivery payments only; no tips)
        loadTransactions(data)
    }
    
    private fun loadTransactions(data: DriverWalletResponse) {
        allTransactions.clear()
        
        // Wallet: 50% delivery fee from Pay Now orders only (no tips)
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        data.recentDeliveryPayments?.forEach { tx ->
            val orderInfo = buildString {
                append("Order #${tx.orderNumber ?: tx.orderId ?: ""}")
                tx.orderLocation?.takeIf { it.isNotBlank() }?.let { loc ->
                    append(" · $loc")
                }
                append(" · Delivery fee (50% to wallet): ${formatter.format(tx.amount)}")
            }
            allTransactions.add(WalletTransactionItem(
                type = "Wallet",
                amount = tx.amount,
                description = orderInfo,
                date = tx.date,
                isPositive = true
            ))
        }
        
        // Sort by date (newest first)
        allTransactions.sortByDescending { parseDate(it.date) }
        
        // Apply filters and display
        applyFilters()
    }
    
    private fun displayCurrentPage() {
        val container = binding.transactionsContainer
        container.removeAllViews()
        
        if (filteredTransactions.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            binding.paginationContainer.visibility = View.GONE
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        val totalPages = getTotalPages()
        val startIndex = (currentPage - 1) * itemsPerPage
        val endIndex = minOf(startIndex + itemsPerPage, filteredTransactions.size)
        val pageTransactions = filteredTransactions.subList(startIndex, endIndex)
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        
        // Display transactions for current page
        pageTransactions.forEach { tx ->
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
        
        // Update pagination controls
        updatePaginationControls(totalPages)
    }
    
    private fun getTotalPages(): Int {
        return if (filteredTransactions.isEmpty()) {
            1
        } else {
            (filteredTransactions.size + itemsPerPage - 1) / itemsPerPage
        }
    }
    
    private fun updatePaginationControls(totalPages: Int) {
        if (totalPages <= 1) {
            binding.paginationContainer.visibility = View.GONE
            return
        }
        
        binding.paginationContainer.visibility = View.VISIBLE
        binding.pageInfoText.text = "Page $currentPage of $totalPages"
        binding.prevPageButton.isEnabled = currentPage > 1
        binding.nextPageButton.isEnabled = currentPage < totalPages
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
        val isPositive: Boolean
    )
}
