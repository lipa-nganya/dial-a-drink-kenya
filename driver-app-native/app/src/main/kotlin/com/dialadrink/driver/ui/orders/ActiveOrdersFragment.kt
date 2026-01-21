package com.dialadrink.driver.ui.orders

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.databinding.FragmentActiveOrdersBinding
import com.dialadrink.driver.services.SocketService
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import org.json.JSONObject

class ActiveOrdersFragment : Fragment() {
    private var _binding: FragmentActiveOrdersBinding? = null
    private val binding get() = _binding!!
    private lateinit var ordersAdapter: OrdersAdapter
    private val TAG = "ActiveOrders"
    private var pollingHandler: android.os.Handler? = null
    private var pollingRunnable: Runnable? = null
    private val POLLING_INTERVAL_MS = 5000L // Poll every 5 seconds
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentActiveOrdersBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerView()
        setupSwipeRefresh()
        setupSocketConnection()
        loadOrders()
        startPolling()
    }
    
    private fun startPolling() {
        pollingHandler = android.os.Handler(android.os.Looper.getMainLooper())
        pollingRunnable = object : Runnable {
            override fun run() {
                // Poll for order updates (sockets not working)
                loadOrders()
                pollingHandler?.postDelayed(this, POLLING_INTERVAL_MS)
            }
        }
        pollingHandler?.postDelayed(pollingRunnable!!, POLLING_INTERVAL_MS)
    }
    
    private fun stopPolling() {
        pollingRunnable?.let { pollingHandler?.removeCallbacks(it) }
        pollingHandler = null
        pollingRunnable = null
    }
    
    private fun setupSocketConnection() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        SocketService.connect(
            driverId = driverId,
            onOrderAssigned = { orderData ->
                handleOrderAssigned(orderData)
            },
            onOrderStatusUpdated = null,
            onPaymentConfirmed = null
        )
    }
    
    private fun handleOrderAssigned(orderData: JSONObject) {
        try {
            val orderId = orderData.getInt("id")
            Log.d(TAG, "📦 New order assigned via socket: $orderId")
            
            // Convert JSONObject to Order model
            val order = Order(
                id = orderId,
                customerName = orderData.optString("customerName", ""),
                customerPhone = orderData.optString("customerPhone", ""),
                deliveryAddress = orderData.optString("deliveryAddress", ""),
                status = orderData.optString("status", "pending"),
                paymentStatus = orderData.optString("paymentStatus", "unpaid"),
                totalAmount = orderData.optDouble("totalAmount", 0.0),
                tipAmount = orderData.optDouble("tipAmount", 0.0),
                driverId = orderData.optInt("driverId", 0),
                createdAt = orderData.optString("createdAt", null)
            )
            
            // Navigate to order acceptance screen
            val intent = Intent(requireContext(), OrderAcceptanceActivity::class.java)
            intent.putExtra("orderId", order.id)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            startActivity(intent)
            
            // Refresh orders list
            loadOrders()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error handling order-assigned event", e)
        }
    }
    
    private fun setupRecyclerView() {
        ordersAdapter = OrdersAdapter { order ->
            // Navigate to order detail
            val intent = Intent(requireContext(), OrderDetailActivity::class.java)
            intent.putExtra("orderId", order.id)
            startActivity(intent)
        }
        
        binding.ordersRecyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = ordersAdapter
        }
    }
    
    private fun setupSwipeRefresh() {
        binding.swipeRefresh.setOnRefreshListener {
            loadOrders()
        }
        binding.swipeRefresh.setColorSchemeColors(
            requireContext().getColor(R.color.accent)
        )
    }
    
    private fun loadOrders() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getActiveOrders(driverId)
                
                if (response.isSuccessful && response.body()?.data != null) {
                    val orders = response.body()!!.data!!
                    ordersAdapter.submitList(orders)
                    
                    if (orders.isEmpty()) {
                        binding.emptyText.text = "No orders in progress"
                        binding.emptyText.visibility = View.VISIBLE
                    } else {
                        binding.emptyText.visibility = View.GONE
                    }
                } else {
                    binding.emptyText.visibility = View.VISIBLE
                    binding.emptyText.text = "Error loading orders"
                }
            } catch (e: Exception) {
                binding.emptyText.visibility = View.VISIBLE
                binding.emptyText.text = "Network error: ${e.message}"
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }
    
    override fun onPause() {
        super.onPause()
        stopPolling()
    }
    
    override fun onResume() {
        super.onResume()
        // Reconnect socket if needed
        val driverId = SharedPrefs.getDriverId(requireContext())
        if (driverId != null && !SocketService.isConnected()) {
            setupSocketConnection()
        }
        startPolling()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        stopPolling()
        SocketService.disconnect()
        _binding = null
    }
}

