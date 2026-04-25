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

class RejectedSubmissionsFragment : Fragment() {
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
                val response = ApiClient.getApiService().getCashSubmissions(driverId, "rejected")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null && data.submissions.isNotEmpty()) {
                        displaySubmissions(data.submissions)
                    } else {
                        binding.emptyStateText.text = "No rejected submissions"
                        binding.emptyStateText.visibility = View.VISIBLE
                    }
                } else {
                    binding.emptyStateText.text = "No rejected submissions"
                    binding.emptyStateText.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.emptyStateText.text = "No rejected submissions"
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
            val dateApprovedText = card.findViewById<TextView>(R.id.dateApprovedText)
            val receiptNumberText = card.findViewById<TextView>(R.id.receiptNumberText)
            
            descriptionText.text = "Order# ${getOrderNumberDisplay(submission)}"
            customerNameText.text = "Submission Type: ${getSubmissionTypeLabel(submission.submissionType)}"
            customerNameText.visibility = View.VISIBLE
            amountText.text = "-${formatter.format(submission.amount)}"
            amountText.setTextColor(requireContext().getColor(android.R.color.holo_red_light))
            dateText.text = "Delivery Address: ${getDeliveryAddress(submission)}"
            dateApprovedText.text = "Posted date and time: ${formatDateTime(submission.createdAt)}"
            dateApprovedText.visibility = View.VISIBLE
            receiptNumberText.text = "Approved date and time: ${formatDateTime(submission.approvedAt)}"
            receiptNumberText.visibility = View.VISIBLE
            
            container.addView(card)
        }
    }
    
    private fun getSubmissionTypeLabel(type: String?): String {
        return when (type) {
            "purchases" -> "Purchase"
            "cash" -> "Expense"
            "general_expense" -> "General Expense"
            "payment_to_office" -> "Payment to Office"
            "walk_in_sale" -> "Walk-in Sale"
            "order_payment" -> "Order Payment"
            else -> "Cash Submission"
        }
    }

    private fun getOrderNumberDisplay(submission: CashSubmission): String {
        val raw = submission.details?.get("orderId")?.toString()
            ?: submission.details?.get("orderNumber")?.toString()
            ?: submission.orders?.firstOrNull()?.orderNumber?.toString()
            ?: submission.orders?.firstOrNull()?.id?.toString()
            ?: submission.id.toString()
        return raw.removeSuffix(".0").trim()
    }

    private fun getDeliveryAddress(submission: CashSubmission): String {
        return submission.details?.get("deliveryAddress")?.toString()
            ?: submission.details?.get("delivery_address")?.toString()
            ?: submission.orders?.firstOrNull { !it.deliveryAddress.isNullOrBlank() }?.deliveryAddress
            ?: "N/A"
    }

    private fun formatDateTime(raw: String?): String {
        if (raw.isNullOrBlank()) return "—"
        return try {
            val parsed = try {
                apiDateFormat.parse(raw)
            } catch (_: Exception) {
                apiDateFormat2.parse(raw)
            }
            parsed?.let { dateFormat.format(it) } ?: raw
        } catch (_: Exception) {
            raw
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
