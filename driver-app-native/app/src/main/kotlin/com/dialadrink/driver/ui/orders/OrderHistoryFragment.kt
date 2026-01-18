package com.dialadrink.driver.ui.orders

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.FragmentActiveOrdersBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class OrderHistoryFragment : Fragment() {
    private var _binding: FragmentActiveOrdersBinding? = null
    private val binding get() = _binding!!
    private lateinit var ordersAdapter: OrdersAdapter
    
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
        loadOrders()
    }
    
    private fun setupRecyclerView() {
        ordersAdapter = OrdersAdapter { order ->
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
        binding.emptyText.text = "No completed orders"
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCompletedOrders(driverId)
                
                if (response.isSuccessful && response.body()?.data != null) {
                    val orders = response.body()!!.data!!
                    ordersAdapter.submitList(orders)
                    
                    if (orders.isEmpty()) {
                        binding.emptyText.visibility = View.VISIBLE
                    } else {
                        binding.emptyText.visibility = View.GONE
                    }
                } else {
                    binding.emptyText.visibility = View.VISIBLE
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
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}


