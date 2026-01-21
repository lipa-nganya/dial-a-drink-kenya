package com.dialadrink.driver.ui.wallet

import android.graphics.Color
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.CreateCashSubmissionRequest
import com.dialadrink.driver.databinding.FragmentCashAtHandFormBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

// Data class for purchase items
data class PurchaseItem(
    val item: String,
    val price: Double
)

class CashAtHandFormFragment : Fragment() {
    private var _binding: FragmentCashAtHandFormBinding? = null
    private val binding get() = _binding!!
    
    private var selectedSubmissionType: String? = null
    private val submissionTypes = listOf("Purchases", "Cash", "General Expense", "Payment to Office")
    private val accountTypes = listOf("mpesa", "till", "bank", "paybill", "pdq")
    private val submissionItems = mutableListOf<PurchaseItem>() // Store multiple items for all submission types
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCashAtHandFormBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupSubmissionTypeDropdown()
        setupAccountTypeDropdown()
        setupSubmitButton()
        setupAmountInput()
        setupAddItemButton()
        loadTotalCash()
        
        // Apply colors after view is fully created
        view.post {
            applyFieldColors()
            forceUpdateFieldBorders()
        }
    }
    
    /**
     * Helper function to apply green border color to a TextInputLayout for all states
     */
    private fun applyGreenBorderToLayout(layout: com.google.android.material.textfield.TextInputLayout) {
        val lightGreen = Color.parseColor("#4CAF50")
        
        // Create ColorStateList that applies green to ALL states (focused, unfocused, enabled, disabled)
        val strokeColorStateList = android.content.res.ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_enabled),
                intArrayOf(-android.R.attr.state_enabled),
                intArrayOf()
            ),
            intArrayOf(lightGreen, lightGreen, lightGreen, lightGreen)
        )
        
        // Use reflection to set ColorStateList for all states
        try {
            val setBoxStrokeColorStateListMethod = layout.javaClass.getMethod(
                "setBoxStrokeColorStateList",
                android.content.res.ColorStateList::class.java
            )
            setBoxStrokeColorStateListMethod.invoke(layout, strokeColorStateList)
        } catch (e: Exception) {
            // Fallback to direct property if reflection fails
            layout.boxStrokeColor = lightGreen
        }
        
        layout.invalidate()
        layout.requestLayout()
    }
    
    private fun forceUpdateFieldBorders() {
        val textSecondary = ContextCompat.getColor(requireContext(), R.color.text_secondary_dark)
        val paperDark = ContextCompat.getColor(requireContext(), R.color.paper_dark)
        
        // Convert 2dp to pixels
        val strokeWidthPx = (2 * resources.displayMetrics.density).toInt()
        
        // Apply green borders to both fields
        applyGreenBorderToLayout(binding.submissionTypeLayout)
        applyGreenBorderToLayout(binding.amountLayout)
        
        // Set other properties
        binding.submissionTypeLayout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(textSecondary)
        binding.submissionTypeLayout.boxBackgroundColor = paperDark
        binding.submissionTypeLayout.boxStrokeWidth = strokeWidthPx
        binding.submissionTypeLayout.boxStrokeWidthFocused = strokeWidthPx
        
        binding.amountLayout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(textSecondary)
        binding.amountLayout.boxBackgroundColor = paperDark
        binding.amountLayout.boxStrokeWidth = strokeWidthPx
        binding.amountLayout.boxStrokeWidthFocused = strokeWidthPx
    }
    
    private fun loadTotalCash() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCashAtHand(driverId)
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null) {
                        updateTotalCash(data.totalCashAtHand ?: 0.0)
                    }
                }
            } catch (e: Exception) {
                // Silently fail - total will show 0.00
            }
        }
    }
    
    fun updateTotalCash(totalCash: Double) {
        val formatted = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("en", "KE")).format(totalCash)
        binding.totalCashText.text = formatted.replace("KES", "KES")
    }
    
    fun refresh() {
        loadTotalCash()
    }
    
    private fun setupSubmissionTypeDropdown() {
        val adapter = ArrayAdapter(requireContext(), R.layout.item_dropdown_dark, submissionTypes)
        (binding.submissionTypeLayout.editText as? AutoCompleteTextView)?.let { autoComplete ->
            autoComplete.setAdapter(adapter)
            
            val drawable = android.graphics.drawable.ColorDrawable(resources.getColor(R.color.paper_dark, null))
            autoComplete.setDropDownBackgroundDrawable(drawable)
            
            autoComplete.setTextColor(Color.parseColor("#FFFFFF"))
            autoComplete.setHintTextColor(Color.parseColor("#B0B0B0"))
            
            // Apply green border using helper function
            applyGreenBorderToLayout(binding.submissionTypeLayout)
            
            binding.submissionTypeLayout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(
                Color.parseColor("#FFFFFF")
            )
            binding.submissionTypeLayout.boxBackgroundColor = Color.TRANSPARENT
            
            // Ensure it stays green after layout
            binding.submissionTypeLayout.post {
                applyGreenBorderToLayout(binding.submissionTypeLayout)
            }
            
            autoComplete.setOnItemClickListener { _, _, position, _ ->
                selectedSubmissionType = when (position) {
                    0 -> "purchases"
                    1 -> "cash"
                    2 -> "general_expense"
                    3 -> "payment_to_office"
                    else -> null
                }
                updateDynamicFields()
            }
        }
    }
    
    private fun setupAccountTypeDropdown() {
        val adapter = ArrayAdapter(requireContext(), R.layout.item_dropdown_dark, accountTypes.map { it.uppercase() })
        (binding.accountTypeLayout.editText as? AutoCompleteTextView)?.let { autoComplete ->
            autoComplete.setAdapter(adapter)
            
            val drawable = android.graphics.drawable.ColorDrawable(resources.getColor(R.color.paper_dark, null))
            autoComplete.setDropDownBackgroundDrawable(drawable)
            
            autoComplete.setTextColor(Color.parseColor("#FFFFFF"))
            autoComplete.setHintTextColor(Color.parseColor("#B0B0B0"))
            
            // Apply green border using helper function
            applyGreenBorderToLayout(binding.accountTypeLayout)
            
            binding.accountTypeLayout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(
                Color.parseColor("#FFFFFF")
            )
        }
    }
    
    private fun updateDynamicFields() {
        binding.supplierLayout.visibility = View.GONE
        binding.itemLayout.visibility = View.VISIBLE // Show item/price for all types
        binding.priceLayout.visibility = View.VISIBLE // Show item/price for all types
        binding.deliveryLocationLayout.visibility = View.GONE
        binding.recipientNameLayout.visibility = View.GONE
        binding.natureLayout.visibility = View.GONE
        binding.accountTypeLayout.visibility = View.GONE
        
        binding.dynamicFieldsContainer.visibility = View.VISIBLE
        
        // Clear items when type changes
        submissionItems.clear()
        binding.itemEditText.text?.clear()
        binding.priceEditText.text?.clear()
        
        when (selectedSubmissionType) {
            "purchases" -> {
                binding.supplierLayout.visibility = View.VISIBLE
                binding.itemLayout.hint = "Item Purchased"
                binding.priceLayout.hint = "Price (KES)"
                binding.deliveryLocationLayout.visibility = View.VISIBLE
                binding.addItemButton.visibility = View.VISIBLE
            }
            "cash" -> {
                binding.itemLayout.hint = "Item/Description"
                binding.priceLayout.hint = "Amount (KES)"
                // Keep recipientName for backward compatibility, but items array is primary
                binding.recipientNameLayout.visibility = View.VISIBLE
                binding.addItemButton.visibility = View.VISIBLE
            }
            "general_expense" -> {
                binding.itemLayout.hint = "Expense Item"
                binding.priceLayout.hint = "Amount (KES)"
                // Keep nature for backward compatibility, but items array is primary
                binding.natureLayout.visibility = View.VISIBLE
                binding.addItemButton.visibility = View.VISIBLE
            }
            "payment_to_office" -> {
                binding.itemLayout.hint = "Payment Item/Description"
                binding.priceLayout.hint = "Amount (KES)"
                binding.accountTypeLayout.visibility = View.VISIBLE
                binding.addItemButton.visibility = View.VISIBLE
            }
            else -> {
                binding.dynamicFieldsContainer.visibility = View.GONE
                binding.addItemButton.visibility = View.GONE
            }
        }
        
        // Update items list display
        updateItemsListDisplay()
        
        applyFieldColors()
    }
    
    private fun setupSubmitButton() {
        binding.submitButton.setOnClickListener {
            submitCashSubmission()
        }
    }
    
    private fun setupAmountInput() {
        binding.amountEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                binding.errorText.visibility = View.GONE
            }
        })
    }
    
    private fun setupAddItemButton() {
        binding.addItemButton.setOnClickListener {
            addItemToList()
        }
    }
    
    private fun addItemToList() {
        val itemName = binding.itemEditText.text.toString().trim()
        val priceText = binding.priceEditText.text.toString().trim()
        val price = priceText.toDoubleOrNull()
        
        if (itemName.isEmpty() || price == null || price <= 0) {
            binding.errorText.text = "Please enter a valid item name and price"
            binding.errorText.visibility = View.VISIBLE
            return
        }
        
        submissionItems.add(PurchaseItem(itemName, price))
        binding.itemEditText.text?.clear()
        binding.priceEditText.text?.clear()
        binding.errorText.visibility = View.GONE
        
        // Update items list display
        updateItemsListDisplay()
        
        // Update total amount display
        val total = submissionItems.sumOf { it.price }
        binding.amountEditText.setText(String.format("%.2f", total))
        
        Toast.makeText(requireContext(), "Item added. Total: KES ${String.format("%.2f", total)}", Toast.LENGTH_SHORT).show()
    }
    
    private fun updateItemsListDisplay() {
        if (submissionItems.isEmpty()) {
            binding.itemsListText.visibility = View.GONE
        } else {
            val itemsText = submissionItems.joinToString("\n") { 
                "• ${it.item}: KES ${String.format("%.2f", it.price)}" 
            }
            binding.itemsListText.text = "Items added:\n$itemsText\nTotal: KES ${String.format("%.2f", submissionItems.sumOf { it.price })}"
            binding.itemsListText.visibility = View.VISIBLE
        }
    }
    
    private fun submitCashSubmission() {
        if (selectedSubmissionType == null) {
            binding.errorText.text = "Please select a submission type"
            binding.errorText.visibility = View.VISIBLE
            return
        }
        
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        // Calculate amount and build details based on submission type
        // All types now support multiple items
        val items = if (submissionItems.isNotEmpty()) {
            submissionItems.map { mapOf("item" to it.item, "price" to it.price) }
        } else {
            // Fallback: try to get single item from fields
            val item = binding.itemEditText.text.toString().trim()
            val price = binding.priceEditText.text.toString().trim().toDoubleOrNull()
            if (item.isNotEmpty() && price != null && price > 0) {
                listOf(mapOf("item" to item, "price" to price))
            } else {
                emptyList()
            }
        }
        
        val (amount, details) = when (selectedSubmissionType) {
            "purchases" -> {
                val supplier = binding.supplierEditText.text.toString().trim()
                val location = binding.deliveryLocationEditText.text.toString().trim()
                
                if (supplier.isEmpty() || items.isEmpty() || location.isEmpty()) {
                    binding.errorText.text = "Please fill all purchase fields and add at least one item"
                    binding.errorText.visibility = View.VISIBLE
                    return
                }
                
                // Calculate total amount from items
                val totalAmount = items.sumOf { (it["price"] as? Number)?.toDouble() ?: 0.0 }
                
                val detailsMap = mutableMapOf<String, Any>(
                    "supplier" to supplier,
                    "items" to items,
                    "deliveryLocation" to location
                )
                
                Pair(totalAmount, detailsMap)
            }
            "cash" -> {
                // Cash can have items array OR single recipientName (backward compatibility)
                if (items.isEmpty()) {
                    val recipient = binding.recipientNameEditText.text.toString().trim()
                    if (recipient.isEmpty()) {
                        binding.errorText.text = "Please add at least one item or enter recipient name"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    val amountText = binding.amountEditText.text.toString().trim()
                    if (amountText.isEmpty()) {
                        binding.errorText.text = "Please enter an amount"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    val calculatedAmount = amountText.toDoubleOrNull()
                    if (calculatedAmount == null || calculatedAmount <= 0) {
                        binding.errorText.text = "Please enter a valid amount"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    Pair(calculatedAmount, mapOf("recipientName" to recipient))
                } else {
                    val totalAmount = items.sumOf { (it["price"] as? Number)?.toDouble() ?: 0.0 }
                    val detailsMap = mutableMapOf<String, Any>("items" to items)
                    // Include recipientName if provided (backward compatibility)
                    val recipient = binding.recipientNameEditText.text.toString().trim()
                    if (recipient.isNotEmpty()) {
                        detailsMap["recipientName"] = recipient
                    }
                    Pair(totalAmount, detailsMap)
                }
            }
            "general_expense" -> {
                // General expense can have items array OR single nature (backward compatibility)
                if (items.isEmpty()) {
                    val nature = binding.natureEditText.text.toString().trim()
                    if (nature.isEmpty()) {
                        binding.errorText.text = "Please add at least one item or enter nature of expenditure"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    val amountText = binding.amountEditText.text.toString().trim()
                    if (amountText.isEmpty()) {
                        binding.errorText.text = "Please enter an amount"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    val calculatedAmount = amountText.toDoubleOrNull()
                    if (calculatedAmount == null || calculatedAmount <= 0) {
                        binding.errorText.text = "Please enter a valid amount"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    Pair(calculatedAmount, mapOf("nature" to nature))
                } else {
                    val totalAmount = items.sumOf { (it["price"] as? Number)?.toDouble() ?: 0.0 }
                    val detailsMap = mutableMapOf<String, Any>("items" to items)
                    // Include nature if provided (backward compatibility)
                    val nature = binding.natureEditText.text.toString().trim()
                    if (nature.isNotEmpty()) {
                        detailsMap["nature"] = nature
                    }
                    Pair(totalAmount, detailsMap)
                }
            }
            "payment_to_office" -> {
                val accountType = (binding.accountTypeLayout.editText as? AutoCompleteTextView)?.text?.toString()?.trim()?.lowercase()
                if (accountType.isNullOrEmpty()) {
                    binding.errorText.text = "Please select account type"
                    binding.errorText.visibility = View.VISIBLE
                    return
                }
                
                // Payment to office can have items array OR single amount
                if (items.isEmpty()) {
                    val amountText = binding.amountEditText.text.toString().trim()
                    if (amountText.isEmpty()) {
                        binding.errorText.text = "Please enter an amount or add items"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    val calculatedAmount = amountText.toDoubleOrNull()
                    if (calculatedAmount == null || calculatedAmount <= 0) {
                        binding.errorText.text = "Please enter a valid amount"
                        binding.errorText.visibility = View.VISIBLE
                        return
                    }
                    Pair(calculatedAmount, mapOf("accountType" to accountType))
                } else {
                    val totalAmount = items.sumOf { (it["price"] as? Number)?.toDouble() ?: 0.0 }
                    val detailsMap = mutableMapOf<String, Any>(
                        "accountType" to accountType,
                        "items" to items
                    )
                    Pair(totalAmount, detailsMap)
                }
            }
            else -> {
                binding.errorText.text = "Invalid submission type"
                binding.errorText.visibility = View.VISIBLE
                return
            }
        }
        
        binding.submitButton.isEnabled = false
        binding.loadingProgress.visibility = View.VISIBLE
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().createCashSubmission(
                    driverId,
                    CreateCashSubmissionRequest(
                        submissionType = selectedSubmissionType!!,
                        amount = amount,
                        details = details
                    )
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(requireContext(), "Cash submission created successfully", Toast.LENGTH_SHORT).show()
                    clearForm()
                    // Refresh total cash
                    loadTotalCash()
                    // Notify parent activity to refresh
                    (activity as? CashAtHandActivity)?.refreshTabs()
                } else {
                    val errorMessage = try {
                        val errorBody = response.errorBody()?.string()
                        if (errorBody != null) {
                            val errorResponse = ApiClient.gson.fromJson(errorBody, com.dialadrink.driver.data.model.ApiResponse::class.java)
                            errorResponse.error ?: "Failed to create cash submission"
                        } else {
                            "Failed to create cash submission"
                        }
                    } catch (e: Exception) {
                        "Failed to create cash submission"
                    }
                    binding.errorText.text = errorMessage
                    binding.errorText.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                binding.errorText.text = "Error: ${e.message}"
                binding.errorText.visibility = View.VISIBLE
            } finally {
                binding.submitButton.isEnabled = true
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun clearForm() {
        binding.submissionTypeLayout.editText?.text?.clear()
        binding.supplierEditText.text?.clear()
        binding.itemEditText.text?.clear()
        binding.priceEditText.text?.clear()
        binding.deliveryLocationEditText.text?.clear()
        binding.recipientNameEditText.text?.clear()
        binding.natureEditText.text?.clear()
        binding.accountTypeLayout.editText?.text?.clear()
        binding.amountEditText.text?.clear()
        binding.errorText.visibility = View.GONE
        selectedSubmissionType = null
        submissionItems.clear()
        binding.dynamicFieldsContainer.visibility = View.GONE
        binding.addItemButton.visibility = View.GONE
        binding.itemsListText.visibility = View.GONE
    }
    
    private fun applyFieldColors() {
        val lightGreen = Color.parseColor("#4CAF50")
        val textPrimary = ContextCompat.getColor(requireContext(), R.color.text_primary_dark)
        val textSecondary = ContextCompat.getColor(requireContext(), R.color.text_secondary_dark)
        val paperDark = ContextCompat.getColor(requireContext(), R.color.paper_dark)
        val strokeWidthPx = (2 * resources.displayMetrics.density).toInt()
        
        // Create ColorStateList that applies green to ALL states (focused, unfocused, enabled, disabled)
        val strokeColorStateList = android.content.res.ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_enabled),
                intArrayOf(-android.R.attr.state_enabled),
                intArrayOf()
            ),
            intArrayOf(lightGreen, lightGreen, lightGreen, lightGreen)
        )
        
        val layouts = listOf(
            binding.submissionTypeLayout,
            binding.supplierLayout,
            binding.itemLayout,
            binding.priceLayout,
            binding.deliveryLocationLayout,
            binding.recipientNameLayout,
            binding.natureLayout,
            binding.accountTypeLayout,
            binding.amountLayout
        )
        
        layouts.forEach { layout ->
            // Apply green border using helper function
            applyGreenBorderToLayout(layout)
            
            layout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(textSecondary)
            layout.boxBackgroundColor = paperDark
            layout.boxStrokeWidth = strokeWidthPx
            layout.boxStrokeWidthFocused = strokeWidthPx
        }
        
        val editTexts = listOf(
            binding.supplierEditText,
            binding.itemEditText,
            binding.priceEditText,
            binding.deliveryLocationEditText,
            binding.recipientNameEditText,
            binding.natureEditText,
            binding.amountEditText
        )
        
        editTexts.forEach { editText ->
            editText.setTextColor(textPrimary)
            editText.setHintTextColor(textSecondary)
            editText.invalidate()
        }
        
        (binding.submissionTypeLayout.editText as? AutoCompleteTextView)?.let { autoComplete ->
            autoComplete.setTextColor(textPrimary)
            autoComplete.setHintTextColor(textSecondary)
            autoComplete.invalidate()
        }
        
        (binding.accountTypeLayout.editText as? AutoCompleteTextView)?.let { autoComplete ->
            autoComplete.setTextColor(textPrimary)
            autoComplete.setHintTextColor(textSecondary)
            autoComplete.invalidate()
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
