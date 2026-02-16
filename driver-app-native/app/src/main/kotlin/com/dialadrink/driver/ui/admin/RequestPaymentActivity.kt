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
        private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
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
        private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        
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
            cardBinding.acceptButton.visibility = View.GONE
            
            // Show Request Payment button
            cardBinding.actionButtons.visibility = View.VISIBLE
            cardBinding.rejectButton.visibility = View.VISIBLE
            cardBinding.rejectButton.text = "Request Payment"
            cardBinding.rejectButton.setOnClickListener {
                showRequestPaymentDialog(order)
            }
            
            return card
        }
        
        private fun showRequestPaymentDialog(order: Order) {
            val orderTotal = order.totalAmount ?: 0.0
            val orderNumber = order.id ?: 0
            val customerName = order.customerName ?: "Customer"
            
            AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Request Payment")
                .setMessage("Send payment prompt to customer for Order #$orderNumber?\n\nAmount: ${currencyFormat.format(orderTotal)}")
                .setPositiveButton("Send M-Pesa Prompt") { _, _ ->
                    requestPaymentFromOrder(order)
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
        
        private fun requestPaymentFromOrder(order: Order) {
            binding.loadingProgress.visibility = View.VISIBLE
            
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    // Use customer phone from order, or null if it's "POS" (walk-in order)
                    val customerPhone = if (order.customerPhone != null && order.customerPhone != "POS") {
                        order.customerPhone
                    } else {
                        null
                    }
                    
                    val request = PromptOrderPaymentRequest(customerPhone = customerPhone)
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
        
        override fun onDestroyView() {
            super.onDestroyView()
            _binding = null
        }
    }
}
