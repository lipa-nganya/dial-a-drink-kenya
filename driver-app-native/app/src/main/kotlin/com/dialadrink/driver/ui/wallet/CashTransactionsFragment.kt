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
import com.dialadrink.driver.data.model.CashAtHandResponse
import com.dialadrink.driver.databinding.FragmentWalletTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class CashTransactionsFragment : Fragment() {
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
        val container = binding.transactionsContainer
        container.removeAllViews()
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        
        if (data.entries.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        data.entries.forEach { entry ->
            val cardView = LayoutInflater.from(requireContext()).inflate(
                R.layout.item_cash_entry,
                container,
                false
            )
            val card = cardView as MaterialCardView
            
            val descriptionText = card.findViewById<TextView>(R.id.descriptionText)
            val customerNameText = card.findViewById<TextView>(R.id.customerNameText)
            val amountText = card.findViewById<TextView>(R.id.amountText)
            val dateText = card.findViewById<TextView>(R.id.dateText)
            val receiptNumberText = card.findViewById<TextView>(R.id.receiptNumberText)
            
            descriptionText.text = entry.description
            
            if (entry.type == "cash_received") {
                if (entry.customerName != null) {
                    customerNameText.text = entry.customerName
                    customerNameText.visibility = View.VISIBLE
                } else {
                    customerNameText.visibility = View.GONE
                }
                amountText.text = "+${formatter.format(entry.amount)}"
                amountText.setTextColor(requireContext().getColor(R.color.accent))
            } else {
                customerNameText.visibility = View.GONE
                amountText.text = "-${formatter.format(entry.amount)}"
                amountText.setTextColor(requireContext().getColor(android.R.color.holo_red_light))
            }
            
            try {
                val date = try {
                    apiDateFormat.parse(entry.date)
                } catch (e: Exception) {
                    apiDateFormat2.parse(entry.date)
                }
                dateText.text = date?.let { dateFormat.format(it) } ?: entry.date
            } catch (e: Exception) {
                dateText.text = entry.date
            }
            
            if (!entry.receiptNumber.isNullOrEmpty()) {
                receiptNumberText.text = "Receipt: ${entry.receiptNumber}"
                receiptNumberText.visibility = View.VISIBLE
            } else {
                receiptNumberText.visibility = View.GONE
            }
            
            container.addView(card)
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
