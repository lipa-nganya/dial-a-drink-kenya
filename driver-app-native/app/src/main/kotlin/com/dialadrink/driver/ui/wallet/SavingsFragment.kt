package com.dialadrink.driver.ui.wallet

import android.app.AlertDialog
import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.DriverWalletResponse
import com.dialadrink.driver.data.model.SavingsWithdrawalInfo
import com.dialadrink.driver.data.model.WithdrawSavingsRequest
import com.dialadrink.driver.databinding.FragmentSavingsBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.*

class SavingsFragment : Fragment() {
    private var _binding: FragmentSavingsBinding? = null
    private val binding get() = _binding!!
    private var savingsWithdrawalInfo: SavingsWithdrawalInfo? = null
    private var currentSavings: Double = 0.0
    
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
        loadWalletData()
    }
    
    private fun setupWithdrawButton() {
        binding.withdrawButton.setOnClickListener {
            showWithdrawDialog()
        }
    }
    
    private fun showWithdrawDialog() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        val driverPhone = SharedPrefs.getDriverPhone(requireContext()) ?: ""
        val maxWithdraw = minOf(savingsWithdrawalInfo?.remainingDailyLimit ?: 0.0, currentSavings)
        
        if (maxWithdraw <= 0) {
            Toast.makeText(requireContext(), "No savings available to withdraw or daily limit reached", Toast.LENGTH_LONG).show()
            return
        }
        
        val dialogView = layoutInflater.inflate(R.layout.dialog_withdraw_savings, null)
        val amountEditText = dialogView.findViewById<EditText>(R.id.amountEditText)
        val phoneEditText = dialogView.findViewById<EditText>(R.id.phoneEditText)
        
        phoneEditText.setText(driverPhone)
        amountEditText.hint = "Max: KES ${String.format("%.2f", maxWithdraw)}"
        
        AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Withdraw Savings")
            .setView(dialogView)
            .setPositiveButton("Withdraw") { _, _ ->
                val amountText = amountEditText.text.toString()
                val phoneText = phoneEditText.text.toString()
                
                if (amountText.isBlank() || phoneText.isBlank()) {
                    Toast.makeText(requireContext(), "Please enter amount and phone number", Toast.LENGTH_SHORT).show()
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
                
                withdrawSavings(driverId, amount, phoneText)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun withdrawSavings(driverId: Int, amount: Double, phoneNumber: String) {
        binding.loadingProgress.visibility = View.VISIBLE
        binding.withdrawButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                val request = WithdrawSavingsRequest(amount = amount, phoneNumber = phoneNumber)
                val response = ApiClient.getApiService().withdrawSavings(driverId, request)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()!!.data!!
                    Toast.makeText(requireContext(), "Withdrawal initiated successfully. ${data.note}", Toast.LENGTH_LONG).show()
                    loadWalletData() // Refresh data
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
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
