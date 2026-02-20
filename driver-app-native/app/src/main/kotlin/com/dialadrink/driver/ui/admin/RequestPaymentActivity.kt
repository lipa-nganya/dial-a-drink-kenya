package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityRequestPaymentBinding
import com.dialadrink.driver.databinding.FragmentRequestPaymentTabBinding
import com.dialadrink.driver.databinding.ItemPendingOrderBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.card.MaterialCardView
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.text.NumberFormat
import java.util.Locale

class RequestPaymentActivity : AppCompatActivity() {
    private lateinit var binding: ActivityRequestPaymentBinding
    private val TAG = "RequestPayment"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRequestPaymentBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupTabs()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Request Payment"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun setupTabs() {
        // Setup ViewPager2 with tabs
        val adapter = RequestPaymentPagerAdapter(this)
        binding.viewPager.adapter = adapter
        
        // Connect TabLayout with ViewPager2
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Riders"
                1 -> "Orders"
                else -> ""
            }
        }.attach()
    }
    
    // ViewPager2 adapter for tabs
    private class RequestPaymentPagerAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
        override fun getItemCount(): Int = 2
        
        override fun createFragment(position: Int): Fragment {
            return when (position) {
                0 -> RidersTabFragment()
                1 -> OrdersTabFragment()
                else -> RidersTabFragment()
            }
        }
    }
    
    // Riders Tab Fragment
    class RidersTabFragment : Fragment() {
        private var _binding: FragmentRequestPaymentTabBinding? = null
        private val binding get() = _binding!!
        private val drivers = mutableListOf<Driver>()
        private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE")).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }
        private val TAG = "RidersTabFragment"
        private var isLoading = false
        
        override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
            _binding = FragmentRequestPaymentTabBinding.inflate(inflater, container, false)
            return binding.root
        }
        
        override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
            super.onViewCreated(view, savedInstanceState)
            
            setupSwipeRefresh()
            loadDrivers()
        }
        
        private fun setupSwipeRefresh() {
            binding.swipeRefresh.setColorSchemeColors(requireContext().getColor(R.color.accent))
            binding.swipeRefresh.setOnRefreshListener {
                loadDrivers()
            }
        }
        
        private fun loadDrivers() {
            if (isLoading) return
            
            isLoading = true
            binding.loadingProgress.visibility = View.VISIBLE
            binding.emptyStateText.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            viewLifecycleOwner.lifecycleScope.launch {
                var driversList = emptyList<Driver>()
                try {
                    driversList = withTimeoutOrNull(10000) {
                        if (!ApiClient.isInitialized()) {
                            ApiClient.init(requireContext())
                        }
                        
                        val response = ApiClient.getApiService().getDrivers()
                        
                        if (!response.isSuccessful || response.body() == null) {
                            Log.w(TAG, "❌ Failed to fetch drivers: ${response.code()}")
                            emptyList()
                        } else {
                            val apiResponse = response.body()!!
                            // Handle both wrapped (ApiResponse) and raw array formats
                            when {
                                apiResponse.success == true && apiResponse.data != null -> apiResponse.data!!
                                apiResponse.data != null && apiResponse.data is List<*> -> {
                                    @Suppress("UNCHECKED_CAST")
                                    apiResponse.data as List<Driver>
                                }
                                else -> emptyList()
                            }
                        }
                    } ?: emptyList()
                } catch (e: CancellationException) {
                    // Ignore
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error loading drivers", e)
                    driversList = emptyList()
                } finally {
                    isLoading = false
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        drivers.clear()
                        drivers.addAll(driversList)
                        displayDrivers()
                    }
                }
            }
        }
        
        private fun displayDrivers() {
            binding.loadingProgress.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            // Clear existing views
            binding.ordersContainer.removeAllViews()
            
            if (drivers.isEmpty()) {
                binding.emptyStateText.visibility = View.VISIBLE
                binding.emptyStateText.text = "No drivers found"
            } else {
                binding.emptyStateText.visibility = View.GONE
                drivers.forEach { driver ->
                    val card = createDriverCard(driver)
                    binding.ordersContainer.addView(card)
                }
            }
        }
        
        private fun createDriverCard(driver: Driver): View {
            val cardBinding = ItemPendingOrderBinding.inflate(LayoutInflater.from(requireContext()), binding.ordersContainer, false)
            val card = cardBinding.root as MaterialCardView
            
            val driverName = driver.name ?: "Driver #${driver.id}"
            val cashAtHand = driver.cashAtHand ?: 0.0
            
            // Show driver name
            cardBinding.orderNumberText.text = driverName
            cardBinding.orderNumberText.gravity = android.view.Gravity.START
            
            // Show cash at hand amount
            cardBinding.customerNameLabel.visibility = View.VISIBLE
            cardBinding.customerNameLabel.text = "Cash at Hand:"
            cardBinding.customerNameText.visibility = View.VISIBLE
            cardBinding.customerNameText.text = currencyFormat.format(cashAtHand).replace("KES", "KES")
            cardBinding.customerNameText.setTypeface(null, android.graphics.Typeface.BOLD)
            
            // Hide other elements
            cardBinding.locationLabel.visibility = View.GONE
            cardBinding.locationText.visibility = View.GONE
            cardBinding.driverLabel.visibility = View.GONE
            cardBinding.driverStatusText.visibility = View.GONE
            cardBinding.acceptButton.visibility = View.GONE
            cardBinding.rejectButton.visibility = View.GONE
            
            // Show action buttons with Request Payment button
            cardBinding.actionButtons.visibility = View.VISIBLE
            cardBinding.rejectButton.visibility = View.VISIBLE
            cardBinding.rejectButton.text = "Request Payment"
            cardBinding.rejectButton.setOnClickListener {
                showRequestPaymentDialog(driver, cashAtHand)
            }
            cardBinding.acceptButton.visibility = View.GONE
            
            return card
        }
        
        private fun showRequestPaymentDialog(driver: Driver, cashAtHand: Double) {
            val driverName = driver.name ?: "Driver #${driver.id}"
            
            // Create custom dialog with amount input
            val dialogView = layoutInflater.inflate(R.layout.dialog_request_payment, null)
            val amountEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.amountEditText)
            val mpesaButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.mpesaButton)
            val reminderButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.reminderButton)
            
            // Set default amount to cash at hand
            amountEditText.setText(cashAtHand.toInt().toString())
            
            val dialog = AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Request Payment from $driverName")
                .setView(dialogView)
                .setNegativeButton("Cancel", null)
                .create()
            
            mpesaButton.setOnClickListener {
                val amountText = amountEditText.text?.toString() ?: ""
                val amount = amountText.toDoubleOrNull() ?: 0.0
                
                if (amount <= 0) {
                    Toast.makeText(requireContext(), "Please enter a valid amount", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                dialog.dismiss()
                requestPayment(driver, amount, "mpesa")
            }
            
            reminderButton.setOnClickListener {
                val amountText = amountEditText.text?.toString() ?: ""
                val amount = amountText.toDoubleOrNull() ?: 0.0
                
                if (amount <= 0) {
                    Toast.makeText(requireContext(), "Please enter a valid amount", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                dialog.dismiss()
                requestPayment(driver, amount, "reminder")
            }
            
            dialog.show()
        }
        
        private fun requestPayment(driver: Driver, amount: Double, type: String) {
            val driverName = driver.name ?: "Driver #${driver.id}"
            binding.loadingProgress.visibility = View.VISIBLE
            
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    val request = RequestPaymentRequest(
                        amount = amount,
                        type = type
                    )
                    
                    val response = ApiClient.getApiService().requestPaymentFromDriver(driver.id, request)
                    
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        
                        if (response.isSuccessful && response.body()?.success == true) {
                            val message = if (type == "mpesa") {
                                "M-Pesa prompt sent to $driverName"
                            } else {
                                "Payment reminder sent to $driverName"
                            }
                            Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
                            loadDrivers() // Refresh the list
                        } else {
                            val errorMsg = response.body()?.error ?: "Failed to request payment"
                            Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        
        override fun onDestroyView() {
            super.onDestroyView()
            _binding = null
        }
    }
    
    // Orders Tab Fragment
    class OrdersTabFragment : Fragment() {
        private var _binding: FragmentRequestPaymentTabBinding? = null
        private val binding get() = _binding!!
        private val orders = mutableListOf<Order>()
        private val TAG = "OrdersTabFragment"
        private var isLoading = false
        private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE")).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }
        
        override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
            _binding = FragmentRequestPaymentTabBinding.inflate(inflater, container, false)
            return binding.root
        }
        
        override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
            super.onViewCreated(view, savedInstanceState)
            
            setupSwipeRefresh()
            loadOrders()
        }
        
        private fun setupSwipeRefresh() {
            binding.swipeRefresh.setColorSchemeColors(requireContext().getColor(R.color.accent))
            binding.swipeRefresh.setOnRefreshListener {
                loadOrders()
            }
        }
        
        private fun loadOrders() {
            if (isLoading) return
            
            isLoading = true
            binding.loadingProgress.visibility = View.VISIBLE
            binding.emptyStateText.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            viewLifecycleOwner.lifecycleScope.launch {
                var ordersList = emptyList<Order>()
                try {
                    ordersList = withTimeoutOrNull(10000) {
                        if (!SharedPrefs.isAdminLoggedIn(requireContext())) {
                            Toast.makeText(requireContext(), "Please log in as admin", Toast.LENGTH_SHORT).show()
                            emptyList()
                        } else {
                            if (!ApiClient.isInitialized()) {
                                ApiClient.init(requireContext())
                            }
                            
                            // Get all orders and filter for unpaid ones
                            val response = ApiClient.getApiService().getAdminOrders()
                            
                            if (response.isSuccessful && response.body() != null) {
                                val ordersResponse = response.body()!!
                                // Filter for orders that have not been paid for
                                // Include all statuses (pending, completed, etc.) - this ensures walk-in completed orders with Mpesa prompt appear
                                ordersResponse.filter { 
                                    it.paymentStatus == "unpaid" || 
                                    it.paymentStatus == null ||
                                    (it.paymentType == "pay_on_delivery" && it.paymentStatus != "paid")
                                }
                            } else {
                                emptyList()
                            }
                        }
                    } ?: emptyList()
                } catch (e: CancellationException) {
                    // Ignore
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error loading orders", e)
                    ordersList = emptyList()
                } finally {
                    isLoading = false
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        orders.clear()
                        orders.addAll(ordersList)
                        displayOrders()
                    }
                }
            }
        }
        
        private fun displayOrders() {
            binding.loadingProgress.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            // Clear existing views
            binding.ordersContainer.removeAllViews()
            
            if (orders.isEmpty()) {
                binding.emptyStateText.visibility = View.VISIBLE
                binding.emptyStateText.text = "No orders requiring payment"
            } else {
                binding.emptyStateText.visibility = View.GONE
                orders.forEach { order ->
                    val card = createOrderCard(order)
                    binding.ordersContainer.addView(card)
                }
            }
        }
        
        private fun createOrderCard(order: Order): View {
            val cardBinding = ItemPendingOrderBinding.inflate(LayoutInflater.from(requireContext()), binding.ordersContainer, false)
            val card = cardBinding.root as MaterialCardView
            
            // Show order number
            cardBinding.orderNumberText.text = "Order #${order.id}"
            cardBinding.orderNumberText.gravity = android.view.Gravity.START
            
            // Show customer name
            cardBinding.customerNameLabel.visibility = View.VISIBLE
            cardBinding.customerNameLabel.text = "Customer:"
            cardBinding.customerNameText.visibility = View.VISIBLE
            cardBinding.customerNameText.text = order.customerName ?: "N/A"
            
            // Show location
            cardBinding.locationLabel.visibility = View.VISIBLE
            cardBinding.locationText.visibility = View.VISIBLE
            cardBinding.locationText.text = order.deliveryAddress ?: "N/A"
            
            // Hide driver-related elements
            cardBinding.driverLabel.visibility = View.GONE
            cardBinding.driverStatusText.visibility = View.GONE
            
            // Show both Request Payment and Received Cash buttons
            cardBinding.actionButtons.visibility = View.VISIBLE
            cardBinding.rejectButton.visibility = View.VISIBLE
            cardBinding.rejectButton.text = "Request Payment"
            cardBinding.rejectButton.setOnClickListener {
                showRequestPaymentDialog(order)
            }
            
            cardBinding.acceptButton.visibility = View.VISIBLE
            cardBinding.acceptButton.text = "Received Cash"
            cardBinding.acceptButton.setOnClickListener {
                markOrderAsCompleted(order)
            }
            
            return card
        }
        
        private fun showRequestPaymentDialog(order: Order) {
            val orderTotal = order.totalAmount ?: 0.0
            val orderNumber = order.id ?: 0
            val customerName = order.customerName ?: "Customer"
            
            // Create dialog with editable phone number field
            val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_make_payment, null)
            val phoneEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.phoneEditText)
            val phoneLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.phoneLayout)
            val amountText = dialogView.findViewById<android.widget.TextView>(R.id.amountText)
            val makePaymentButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.makePaymentButton)
            
            // Show order amount
            amountText.text = "Amount: ${currencyFormat.format(orderTotal)}"
            
            // Prefill phone number from order, but allow editing
            val initialPhone = if (order.customerPhone != null && order.customerPhone != "POS") {
                order.customerPhone
            } else {
                ""
            }
            phoneEditText.setText(initialPhone)
            phoneLayout.hint = "Customer Phone Number"
            
            val dialog = AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Make Payment - Order #$orderNumber")
                .setView(dialogView)
                .setNegativeButton("Cancel", null)
                .create()
            
            // Handle button click inside dialog
            makePaymentButton.setOnClickListener {
                val phoneNumber = phoneEditText.text?.toString()?.trim() ?: ""
                if (phoneNumber.isEmpty()) {
                    Toast.makeText(requireContext(), "Please enter customer phone number", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                dialog.dismiss()
                requestPaymentFromOrder(order, phoneNumber)
            }
            
            dialog.show()
        }
        
        private fun requestPaymentFromOrder(order: Order, customerPhone: String) {
            binding.loadingProgress.visibility = View.VISIBLE
            
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    // Use provided phone number (can be edited by admin)
                    val request = PromptOrderPaymentRequest(customerPhone = customerPhone.ifEmpty { null })
                    val response = ApiClient.getApiService().promptOrderPayment(order.id, request)
                    
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        
                        if (response.isSuccessful && response.body()?.success == true) {
                            Toast.makeText(requireContext(), "Payment prompt sent to customer", Toast.LENGTH_SHORT).show()
                            loadOrders() // Refresh the list
                        } else {
                            val errorMsg = response.body()?.error ?: "Failed to send payment prompt"
                            Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        
        private fun markOrderAsCompleted(order: Order) {
            // Check if this is a walk-in order
            val isWalkIn = order.deliveryAddress == "In-Store Purchase"
            
            // Show confirmation dialog with appropriate message
            val message = if (isWalkIn) {
                "Mark Order #${order.id} as completed? This will update the payment status to 'paid' and complete the order."
            } else {
                "Mark payment as received for Order #${order.id}? This will update the payment status to 'paid'. The order will remain in its current status for the rider to complete delivery."
            }
            
            AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Received Cash")
                .setMessage(message)
                .setPositiveButton("Yes") { _, _ ->
                    markPaymentAsReceived(order)
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
        
        private fun markPaymentAsReceived(order: Order) {
            binding.loadingProgress.visibility = View.VISIBLE
            
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    // Check if this is a walk-in order
                    val isWalkIn = order.deliveryAddress == "In-Store Purchase"
                    
                    // Always update payment status to paid since cash was received
                    val paymentStatusRequest = UpdatePaymentStatusRequest(paymentStatus = "paid")
                    val paymentStatusResponse = ApiClient.getApiService().updateOrderPaymentStatus(order.id, paymentStatusRequest)
                    
                    if (!paymentStatusResponse.isSuccessful) {
                        withContext(Dispatchers.Main) {
                            binding.loadingProgress.visibility = View.GONE
                            val errorMsg = paymentStatusResponse.body()?.error ?: "Failed to update payment status"
                            Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_SHORT).show()
                        }
                        return@launch
                    }
                    
                    // Only update order status to completed if it's a walk-in order
                    if (isWalkIn) {
                        val driverId = order.driverId ?: 0
                        val statusRequest = UpdateOrderStatusRequest(status = "completed", driverId = driverId)
                        val statusResponse = ApiClient.getApiService().updateAdminOrderStatus(order.id, statusRequest)
                        
                        withContext(Dispatchers.Main) {
                            binding.loadingProgress.visibility = View.GONE
                            
                            if (statusResponse.isSuccessful && paymentStatusResponse.isSuccessful) {
                                Toast.makeText(requireContext(), "Walk-in order marked as completed and payment received", Toast.LENGTH_SHORT).show()
                                loadOrders() // Refresh the list - walk-in order should disappear as it's now completed and paid
                            } else {
                                val errorMsg = statusResponse.body()?.error ?: paymentStatusResponse.body()?.error ?: "Failed to update order"
                                Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_SHORT).show()
                            }
                        }
                    } else {
                        // For delivery orders, only payment status is updated
                        withContext(Dispatchers.Main) {
                            binding.loadingProgress.visibility = View.GONE
                            
                            if (paymentStatusResponse.isSuccessful) {
                                Toast.makeText(requireContext(), "Payment marked as received. Rider no longer needs to collect payment.", Toast.LENGTH_SHORT).show()
                                loadOrders() // Refresh the list - order may disappear if it was only showing unpaid orders
                            } else {
                                val errorMsg = paymentStatusResponse.body()?.error ?: "Failed to update payment status"
                                Toast.makeText(requireContext(), errorMsg, Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        
        override fun onDestroyView() {
            super.onDestroyView()
            _binding = null
        }
    }
}
