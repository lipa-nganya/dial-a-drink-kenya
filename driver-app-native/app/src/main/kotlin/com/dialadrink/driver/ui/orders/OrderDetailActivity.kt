package com.dialadrink.driver.ui.orders

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.ConfirmCashPaymentRequest
import com.dialadrink.driver.data.model.InitiatePaymentRequest
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.data.model.UpdateOrderStatusRequest
import com.dialadrink.driver.databinding.ActivityOrderDetailBinding
import com.dialadrink.driver.services.SocketService
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class OrderDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOrderDetailBinding
    private var orderId: Int = -1
    private val TAG = "OrderDetail"
    private var currentOrder: Order? = null
    private var driverCashAtHand: Double = 0.0
    private var driverCreditLimit: Double = 0.0
    private var creditLimitExceeded: Boolean = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOrderDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        orderId = intent.getIntExtra("orderId", -1)
        if (orderId == -1) {
            finish()
            return
        }
        
        setupToolbar()
        
        // Clear dummy data from XML layout before loading real data
        clearDummyData()
        
        setupSocketConnection()
        setupButtons()
        loadDriverData()
        loadOrderDetails()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Order #$orderId"

        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun clearDummyData() {
        binding.orderNumberText.text = ""
        binding.customerNameText.text = ""
        binding.customerPhoneText.text = ""
        binding.addressText.text = ""
        binding.itemsText.text = ""
        binding.totalAmountText.text = ""
        binding.statusText.text = ""
        binding.paymentStatusText.text = ""
    }
    
    private fun setupSocketConnection() {
        val driverId = SharedPrefs.getDriverId(this) ?: return
        
        Log.d(TAG, "🔌 Setting up socket connection for OrderDetailActivity - Order #$orderId")
        
        SocketService.connect(
            driverId = driverId,
            onOrderAssigned = { orderData ->
                // Handle order assignment (not relevant for order detail screen)
            },
            onOrderStatusUpdated = { orderData ->
                try {
                    // Handle both orderId and id fields (backend may send either)
                    val updatedOrderId = orderData.optInt("orderId", orderData.optInt("id", -1))
                    val status = orderData.optString("status", "")
                    val paymentStatus = orderData.optString("paymentStatus", "")
                    
                    Log.d(TAG, "📦 Order status updated via socket: Order #$updatedOrderId -> $status, Payment: $paymentStatus")
                    
                    if (updatedOrderId == orderId) {
                        // This order was updated, reload details immediately
                        Log.d(TAG, "✅ Reloading order details for Order #$orderId due to socket update")
                        loadOrderDetails()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-status-updated event", e)
                    // Still reload on error to ensure UI is up to date
                    loadOrderDetails()
                }
            },
            onPaymentConfirmed = { paymentData ->
                try {
                    val paymentOrderId = paymentData.optInt("orderId", -1)
                    val paymentStatus = paymentData.optString("paymentStatus", "")
                    
                    Log.d(TAG, "💰 Payment confirmed via socket: Order #$paymentOrderId, Status: $paymentStatus")
                    
                    if (paymentOrderId == orderId) {
                        // Payment confirmed for this order, reload details immediately
                        Log.d(TAG, "✅ Reloading order details for Order #$orderId due to payment confirmation")
                        loadOrderDetails()
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling payment-confirmed event", e)
                    // Still reload on error to ensure UI is up to date
                    loadOrderDetails()
                }
            }
        )
        
        // Join order room for real-time updates specific to this order
        SocketService.joinOrderRoom(orderId)
        Log.d(TAG, "✅ Joined order room for Order #$orderId")
    }
    
    private fun loadOrderDetails() {
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getOrderDetails(orderId)
                
                if (response.isSuccessful && response.body()?.data != null) {
                    val order = response.body()!!.data!!
                    currentOrder = order
                    val branchInfo = order.branch?.let { "id=${it.id}, name=${it.name}" } ?: "null"
                    Log.d(TAG, "Order loaded: id=${order.id}, branch=$branchInfo, status=${order.status}")
                    displayOrder(order)
                } else {
                    Toast.makeText(this@OrderDetailActivity, "Failed to load order", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading order details", e)
                Toast.makeText(this@OrderDetailActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun displayOrder(order: Order) {
        binding.orderNumberText.text = "Order #${order.id}"
        binding.customerNameText.text = order.customerName
        binding.customerPhoneText.text = order.customerPhone
        binding.addressText.text = order.deliveryAddress
        
        val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        binding.totalAmountText.text = formatter.format(order.totalAmount)
        
        // Status badge - display as pill
        val status = order.status.lowercase()
        val statusColor = getStatusColor(order.status)
        val statusDrawable = android.graphics.drawable.GradientDrawable().apply {
            setColor(statusColor)
            cornerRadius = 12f * resources.displayMetrics.density
        }
        binding.statusBadge.background = statusDrawable
        binding.statusText.text = order.status.replace("_", " ").uppercase()
        
        // Payment status badge - display as pill
        val paymentStatusColor = getPaymentStatusColor(order.paymentStatus)
        val paymentDrawable = android.graphics.drawable.GradientDrawable().apply {
            setColor(paymentStatusColor)
            cornerRadius = 12f * resources.displayMetrics.density
        }
        binding.paymentStatusBadge.background = paymentDrawable
        binding.paymentStatusText.text = order.paymentStatus.uppercase()
        
        // Display order items
        val itemsText = order.items.joinToString("\n") { item ->
            "${item.quantity}x ${item.drink?.name ?: "Item"} - ${formatter.format(item.price)}"
        }
        binding.itemsText.text = itemsText
        
        // Show/hide customer phone based on status
        if (status == "completed" || status == "cancelled") {
            // Hide phone number when order is completed or cancelled
            binding.customerPhoneContainer.visibility = View.GONE
        } else {
            binding.customerPhoneContainer.visibility = View.VISIBLE
        }
        
        // Display payment details for completed orders
        val completedStatuses = listOf("completed", "delivered", "cancelled")
        if (completedStatuses.contains(status)) {
            val paymentDetails = buildPaymentInfo(order)
            if (paymentDetails.isNotEmpty()) {
                binding.paymentDetailsText.text = paymentDetails
                binding.paymentDetailsText.visibility = View.VISIBLE
            } else {
                binding.paymentDetailsText.visibility = View.GONE
            }
        } else {
            binding.paymentDetailsText.visibility = View.GONE
        }
        
        // Branch location and navigation button removed - no longer displayed
        binding.branchText.visibility = View.GONE
        binding.navigateToBranchButton.visibility = View.GONE
        
        // Hide navigate to customer button for completed orders
        if (completedStatuses.contains(status)) {
            binding.navigateToCustomerButton.visibility = View.GONE
        } else {
            binding.navigateToCustomerButton.visibility = View.VISIBLE
        }
        
        // Show/hide call button based on status
        val hideCallButtonStatuses = listOf("completed", "cancelled", "delivered")
        if (hideCallButtonStatuses.contains(status)) {
            binding.callCustomerButton.visibility = View.GONE
        } else {
            binding.callCustomerButton.visibility = View.VISIBLE
        }
        
        // Show/hide buttons based on status
        updateButtonVisibility(order)
    }
    
    private fun updateButtonVisibility(order: Order) {
        val status = order.status.lowercase()
        
        val showOutForDelivery = status == "confirmed"
        val showDelivered = status == "out_for_delivery"
        val showReceivedCash = status == "out_for_delivery" && order.paymentStatus.lowercase() != "paid"
        
        // Show cancel button for confirmed or out_for_delivery orders, but not if already cancelled or cancellation requested
        val canCancel = (status == "confirmed" || status == "out_for_delivery") && 
                        status != "cancelled" && 
                        order.cancellationRequested != true
        
        binding.outForDeliveryButton.visibility = if (showOutForDelivery) View.VISIBLE else View.GONE
        binding.deliveredButton.visibility = if (showDelivered) View.VISIBLE else View.GONE
        binding.receivedCashButton.visibility = if (showReceivedCash) View.VISIBLE else View.GONE
        binding.cancelOrderButton.visibility = if (canCancel) View.VISIBLE else View.GONE
        
        // Show cancellation status if requested
        if (order.cancellationRequested == true) {
            val statusText = when {
                order.cancellationApproved == true -> "Cancellation approved"
                order.cancellationApproved == false -> "Cancellation request rejected"
                else -> "Cancellation requested - waiting for admin approval"
            }
            binding.cancellationStatusText.text = statusText
            binding.cancellationStatusText.visibility = View.VISIBLE
            binding.cancelOrderButton.visibility = View.GONE
        } else {
            binding.cancellationStatusText.visibility = View.GONE
        }
        
        // Disable buttons if credit limit exceeded
        val shouldDisableButtons = creditLimitExceeded && (showOutForDelivery || showDelivered || showReceivedCash)
        
        if (shouldDisableButtons) {
            binding.outForDeliveryButton.isEnabled = false
            binding.deliveredButton.isEnabled = false
            binding.receivedCashButton.isEnabled = false
            
            // Grey out buttons
            binding.outForDeliveryButton.alpha = 0.5f
            binding.deliveredButton.alpha = 0.5f
            binding.receivedCashButton.alpha = 0.5f
            
            // Show warning message
            binding.creditLimitWarningText.visibility = View.VISIBLE
        } else {
            binding.outForDeliveryButton.isEnabled = true
            binding.deliveredButton.isEnabled = true
            binding.receivedCashButton.isEnabled = true
            
            // Restore button opacity
            binding.outForDeliveryButton.alpha = 1.0f
            binding.deliveredButton.alpha = 1.0f
            binding.receivedCashButton.alpha = 1.0f
            
            // Hide warning message
            binding.creditLimitWarningText.visibility = View.GONE
        }
    }
    
    private fun loadDriverData() {
        val driverPhone = SharedPrefs.getDriverPhone(this) ?: return
        val driverId = SharedPrefs.getDriverId(this) ?: return
        
        lifecycleScope.launch {
            try {
                // Load driver data and pending cash submissions in parallel
                val driverResponse = ApiClient.getApiService().getDriverByPhone(driverPhone)
                
                if (driverResponse.isSuccessful && driverResponse.body()?.data != null) {
                    val driver = driverResponse.body()!!.data!!
                    driverCashAtHand = driver.cashAtHand ?: 0.0
                    driverCreditLimit = driver.creditLimit ?: 0.0
                    
                    // Check for pending cash submissions
                    var pendingSubmissionsAmount = 0.0
                    try {
                        val submissionsResponse = ApiClient.getApiService().getCashSubmissions(driverId, "pending")
                        if (submissionsResponse.isSuccessful && submissionsResponse.body()?.success == true) {
                            val submissions = submissionsResponse.body()?.data?.submissions ?: emptyList()
                            pendingSubmissionsAmount = submissions
                                .filter { it.status == "pending" }
                                .sumOf { it.amount }
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Error fetching pending submissions, proceeding without them", e)
                    }
                    
                    // Calculate tentative balance (cash at hand after pending submissions)
                    val tentativeBalance = driverCashAtHand - pendingSubmissionsAmount
                    
                    // Check if credit limit is exceeded
                    // If creditLimit is 0, any cashAtHand > 0 means exceeded
                    // If creditLimit > 0, cashAtHand > creditLimit means exceeded
                    val exceededByCurrentBalance = if (driverCreditLimit > 0) {
                        driverCashAtHand > driverCreditLimit
                    } else {
                        driverCashAtHand > 0
                    }
                    
                    // Allow updates if:
                    // 1. Current balance is within limit, OR
                    // 2. Current balance exceeds limit BUT tentative balance is 0 or below (pending submissions clear the balance)
                    creditLimitExceeded = if (exceededByCurrentBalance) {
                        // If tentative balance is 0 or below, allow updates even if current balance exceeds limit
                        tentativeBalance > 0 && pendingSubmissionsAmount == 0.0
                    } else {
                        false
                    }
                    
                    Log.d(TAG, "Driver credit limit check: cashAtHand=$driverCashAtHand, creditLimit=$driverCreditLimit, pendingSubmissions=$pendingSubmissionsAmount, tentativeBalance=$tentativeBalance, exceeded=$creditLimitExceeded")
                    
                    // Update button states if order is already loaded
                    currentOrder?.let { updateButtonVisibility(it) }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading driver data", e)
                // Don't block order loading if driver data fails
            }
        }
    }
    
    private fun getStatusColor(status: String): Int {
        return when (status.lowercase()) {
            "pending" -> getColor(R.color.status_pending)
            "confirmed" -> getColor(R.color.status_confirmed)
            "out_for_delivery" -> getColor(R.color.status_out_for_delivery)
            "delivered" -> getColor(R.color.status_delivered)
            "completed" -> getColor(R.color.status_completed)
            "cancelled" -> getColor(R.color.status_cancelled)
            else -> getColor(R.color.status_default)
        }
    }
    
    private fun getPaymentStatusColor(paymentStatus: String): Int {
        return when (paymentStatus.lowercase()) {
            "paid" -> getColor(R.color.status_completed) // Green for paid
            "unpaid" -> getColor(R.color.status_pending) // Orange for unpaid
            "pending" -> getColor(R.color.status_preparing) // Purple for pending
            else -> getColor(R.color.status_default)
        }
    }
    
    private fun buildPaymentInfo(order: Order): String {
        val paymentMethod = order.paymentMethod?.lowercase() ?: return ""
        
        return when (paymentMethod) {
            "cash" -> "Payment: Cash"
            "mobile_money" -> {
                val transactionCode = order.transactionCode
                val transactionDate = order.transactionDate
                
                if (transactionCode != null && transactionDate != null) {
                    // Format: Payment: M-Pesa\nCode: CODE\nDate: DD/MM/YY HH:MM:SS
                    val formattedDate = formatTransactionDate(transactionDate)
                    "Payment: M-Pesa\nCode: $transactionCode\nDate: $formattedDate"
                } else if (transactionCode != null) {
                    // Just show code if date is missing
                    "Payment: M-Pesa\nCode: $transactionCode"
                } else {
                    "Payment: M-Pesa"
                }
            }
            else -> ""
        }
    }
    
    private fun formatTransactionDate(dateString: String): String {
        return try {
            // Try parsing various date formats (UTC)
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                "yyyy-MM-dd HH:mm:ss",
                "yyyy-MM-dd'T'HH:mm:ss"
            )
            
            // Set UTC timezone for parsing
            val utcTimeZone = TimeZone.getTimeZone("UTC")
            var date: java.util.Date? = null
            for (format in formats) {
                try {
                    val parser = SimpleDateFormat(format, Locale.getDefault())
                    parser.timeZone = utcTimeZone
                    date = parser.parse(dateString)
                    if (date != null) break
                } catch (e: Exception) {
                    // Try next format
                }
            }
            
            if (date != null) {
                // Format as DD/MM/YY HH:MM:SS in Nairobi timezone (EAT, UTC+3)
                val nairobiTimeZone = TimeZone.getTimeZone("Africa/Nairobi")
                val formatter = SimpleDateFormat("dd/MM/yy HH:mm:ss", Locale.getDefault())
                formatter.timeZone = nairobiTimeZone
                formatter.format(date)
            } else {
                dateString // Return original if parsing fails
            }
        } catch (e: Exception) {
            dateString // Return original if formatting fails
        }
    }
    
    private fun setupButtons() {
        // Call customer button
        binding.callCustomerButton.setOnClickListener {
            currentOrder?.let { order ->
                callCustomer(order.customerPhone)
            }
        }
        
        // Navigate to customer button
        binding.navigateToCustomerButton.setOnClickListener {
            currentOrder?.let { order ->
                navigateToLocation(order.deliveryAddress, null, null)
            }
        }
        
        // Out for delivery button - update status first, then prompt for payment
        binding.outForDeliveryButton.setOnClickListener {
            updateStatusToOutForDelivery()
        }
        
        binding.deliveredButton.setOnClickListener { updateStatus("delivered") }
        binding.receivedCashButton.setOnClickListener { showPaymentOptions() }
        binding.cancelOrderButton.setOnClickListener { showCancelOrderDialog() }
    }
    
    private fun showCancelOrderDialog() {
        val input = android.widget.EditText(this)
        input.hint = "Enter cancellation reason"
        input.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
        
        AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Request Order Cancellation")
            .setMessage("Please provide a reason for cancelling this order. Admin approval is required.")
            .setView(input)
            .setPositiveButton("Submit Request") { _, _ ->
                val reason = input.text.toString().trim()
                if (reason.isEmpty()) {
                    Toast.makeText(this, "Please provide a cancellation reason", Toast.LENGTH_SHORT).show()
                } else {
                    requestCancellation(reason)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun requestCancellation(reason: String) {
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Toast.makeText(this, "Driver ID not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.cancelOrderButton.isEnabled = false
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().requestCancellation(
                    orderId,
                    com.dialadrink.driver.data.model.RequestCancellationRequest(driverId, reason)
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@OrderDetailActivity, "Cancellation request submitted. Waiting for admin approval.", Toast.LENGTH_LONG).show()
                    loadOrderDetails() // Reload to show updated status
                } else {
                    val errorMessage = response.body()?.error ?: "Failed to submit cancellation request"
                    Toast.makeText(this@OrderDetailActivity, errorMessage, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error requesting cancellation", e)
                Toast.makeText(this@OrderDetailActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.cancelOrderButton.isEnabled = true
            }
        }
    }
    
    private fun callCustomer(phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:$phoneNumber")
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "Unable to make call", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun navigateToLocation(address: String, latitude: Double?, longitude: Double?) {
        try {
            val uri = if (latitude != null && longitude != null) {
                // Use coordinates if available
                Uri.parse("google.navigation:q=$latitude,$longitude")
            } else {
                // Use address if coordinates not available
                Uri.parse("google.navigation:q=${Uri.encode(address)}")
            }
            
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage("com.google.android.apps.maps")
            }
            
            if (intent.resolveActivity(packageManager) != null) {
                startActivity(intent)
            } else {
                // Fallback to web maps
                val webUri = if (latitude != null && longitude != null) {
                    Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude")
                } else {
                    Uri.parse("https://www.google.com/maps/search/?api=1&query=${Uri.encode(address)}")
                }
                val webIntent = Intent(Intent.ACTION_VIEW, webUri)
                startActivity(webIntent)
            }
        } catch (e: Exception) {
            Toast.makeText(this, "Unable to open maps", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun updateStatusToOutForDelivery() {
        // Check credit limit before allowing update
        if (creditLimitExceeded) {
            Toast.makeText(this, "Please clear your cash at hand to update orders", Toast.LENGTH_LONG).show()
            return
        }
        
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Toast.makeText(this, "Driver ID not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().updateOrderStatus(
                    orderId,
                    UpdateOrderStatusRequest("out_for_delivery", driverId)
                )
                
                if (response.isSuccessful) {
                    Toast.makeText(this@OrderDetailActivity, "Status updated to Out for Delivery", Toast.LENGTH_SHORT).show()
                    
                    // After status is updated, check if payment prompt is needed
                    currentOrder?.let { order ->
                        val paymentType = order.paymentType?.lowercase() ?: "pay_on_delivery"
                        val paymentStatus = order.paymentStatus.lowercase()
                        
                        if (paymentType == "pay_on_delivery" && paymentStatus != "paid") {
                            // Show payment reminder (non-blocking)
                            AlertDialog.Builder(this@OrderDetailActivity, R.style.Theme_DialADrinkDriver_AlertDialog)
                                .setTitle("Payment Reminder")
                                .setMessage("This order requires payment on delivery. Please collect payment from the customer when you arrive.")
                                .setPositiveButton("Got it", null)
                                .show()
                        }
                    }
                    
                    loadOrderDetails() // Reload to show updated status
                } else {
                    Toast.makeText(this@OrderDetailActivity, "Failed to update status", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@OrderDetailActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun updateStatus(newStatus: String) {
        // Check credit limit before allowing update
        if (creditLimitExceeded) {
            Toast.makeText(this, "Please clear your cash at hand to update orders", Toast.LENGTH_LONG).show()
            return
        }
        
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Toast.makeText(this, "Driver ID not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().updateOrderStatus(
                    orderId,
                    UpdateOrderStatusRequest(newStatus, driverId)
                )
                
                if (response.isSuccessful) {
                    Toast.makeText(this@OrderDetailActivity, "Status updated", Toast.LENGTH_SHORT).show()
                    loadOrderDetails() // Reload to show updated status
                } else {
                    Toast.makeText(this@OrderDetailActivity, "Failed to update status", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@OrderDetailActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun showPaymentOptions() {
        // Check credit limit before allowing payment
        if (creditLimitExceeded) {
            Toast.makeText(this, "Please clear your cash at hand to update orders", Toast.LENGTH_LONG).show()
            return
        }
        
        currentOrder?.let { order ->
            AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Payment Options")
                .setMessage("How would you like to process payment?")
                .setPositiveButton("M-Pesa Payment") { _, _ ->
                    initiateMpesaPayment(order)
                }
                .setNegativeButton("Received Cash") { _, _ ->
                    confirmCashPayment()
                }
                .setNeutralButton("Cancel", null)
                .show()
        }
    }
    
    private fun initiateMpesaPayment(order: Order) {
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Toast.makeText(this, "Driver ID not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        val customerPhone = order.customerPhone
        if (customerPhone.isBlank()) {
            Toast.makeText(this, "Customer phone number not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().initiatePayment(
                    orderId,
                    InitiatePaymentRequest(driverId, customerPhone)
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@OrderDetailActivity, "M-Pesa payment request sent to customer", Toast.LENGTH_SHORT).show()
                    loadOrderDetails() // Reload to show updated status
                } else {
                    val errorMessage = response.body()?.error ?: "Failed to initiate payment"
                    Toast.makeText(this@OrderDetailActivity, errorMessage, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@OrderDetailActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun confirmCashPayment() {
        val driverId = SharedPrefs.getDriverId(this) ?: run {
            Toast.makeText(this, "Driver ID not found", Toast.LENGTH_SHORT).show()
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().confirmCashPayment(
                    orderId,
                    ConfirmCashPaymentRequest(driverId, method = "cash")
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@OrderDetailActivity, "Cash payment confirmed", Toast.LENGTH_SHORT).show()
                    loadOrderDetails() // Reload to show updated payment status
                } else {
                    val errorMessage = response.body()?.error ?: "Failed to confirm cash payment"
                    Toast.makeText(this@OrderDetailActivity, errorMessage, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@OrderDetailActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        SocketService.disconnect()
    }
    
    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}
