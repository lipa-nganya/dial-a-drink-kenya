package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.CashSubmission
import com.dialadrink.driver.databinding.FragmentWalletTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class PendingSubmissionsFragment : Fragment() {
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
        loadSubmissions()
    }
    
    fun refresh() {
        loadSubmissions()
    }
    
    private fun loadSubmissions() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCashSubmissions(driverId, "pending")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null && data.submissions.isNotEmpty()) {
                        // Double-check: filter out any non-pending submissions
                        val pendingOnly = data.submissions.filter { it.status == "pending" }
                        android.util.Log.d("PendingSubmissions", "Received ${data.submissions.size} submissions, ${pendingOnly.size} are actually pending")
                        if (pendingOnly.isNotEmpty()) {
                            displaySubmissions(pendingOnly)
                        } else {
                            binding.emptyStateText.text = "No pending submissions"
                            binding.emptyStateText.visibility = View.VISIBLE
                        }
                    } else {
                        binding.emptyStateText.text = "No pending submissions"
                        binding.emptyStateText.visibility = View.VISIBLE
                    }
                } else {
                    android.util.Log.e("PendingSubmissions", "Failed to fetch submissions: ${response.code()}")
                    binding.emptyStateText.text = "No pending submissions"
                    binding.emptyStateText.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                android.util.Log.e("PendingSubmissions", "Error fetching submissions", e)
                binding.emptyStateText.text = "No pending submissions"
                binding.emptyStateText.visibility = View.VISIBLE
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun displaySubmissions(submissions: List<CashSubmission>) {
        // Hide table, show container
        binding.root.findViewById<View>(R.id.tableContainer)?.visibility = View.GONE
        binding.transactionsContainer.visibility = View.VISIBLE
        
        val container = binding.transactionsContainer
        container.removeAllViews()
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        
        binding.emptyStateText.visibility = View.GONE
        
        submissions.forEach { submission ->
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
            
            descriptionText.text = getSubmissionDescription(submission)
            customerNameText.visibility = View.GONE
            amountText.text = "-${formatter.format(submission.amount)}"
            amountText.setTextColor(requireContext().getColor(android.R.color.holo_orange_light))
            
            try {
                val date = try {
                    apiDateFormat.parse(submission.createdAt)
                } catch (e: Exception) {
                    apiDateFormat2.parse(submission.createdAt)
                }
                dateText.text = date?.let { dateFormat.format(it) } ?: submission.createdAt
            } catch (e: Exception) {
                dateText.text = submission.createdAt
            }
            
            receiptNumberText.text = "Status: Pending Approval"
            receiptNumberText.visibility = View.VISIBLE
            
            container.addView(card)
        }
    }
    
    private fun getSubmissionDescription(submission: CashSubmission): String {
        return when (submission.submissionType) {
            "purchases" -> {
                val supplier = submission.details?.get("supplier")?.toString() ?: "Unknown"
                val item = submission.details?.get("item")?.toString() ?: "Unknown"
                "Purchase: $item from $supplier"
            }
            "cash" -> {
                val recipient = submission.details?.get("recipientName")?.toString() ?: "Unknown"
                "Cash to: $recipient"
            }
            "general_expense" -> {
                val nature = submission.details?.get("nature")?.toString() ?: "Unknown"
                "Expense: $nature"
            }
            "payment_to_office" -> {
                val accountType = submission.details?.get("accountType")?.toString() ?: "Unknown"
                "Payment to office: $accountType"
            }
            else -> "Cash Submission"
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
