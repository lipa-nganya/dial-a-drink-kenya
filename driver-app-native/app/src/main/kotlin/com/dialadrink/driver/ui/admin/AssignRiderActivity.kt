package com.dialadrink.driver.ui.admin

import android.app.AlertDialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityAssignRiderBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class AssignRiderActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAssignRiderBinding
    private val unassignedOrders = mutableListOf<Order>()
    private val drivers = mutableListOf<Driver>()
    private val driverOrderCounts = mutableMapOf<Int, Int>()
    private var ordersAdapter: OrdersAdapter? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAssignRiderBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Assign Rider"

        setupRecyclerView()
        updateUnassignedCount(0) // Initialize count to 0
        loadUnassignedOrders()
        loadDrivers()
        
        binding.swipeRefresh.setOnRefreshListener {
            loadUnassignedOrders()
            loadDrivers()
        }
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
    
    private fun updateUnassignedCount(count: Int) {
        binding.unassignedCountText.text = when (count) {
            0 -> "No orders"
            1 -> "1 order"
            else -> "$count orders"
        }
    }

    private fun setupRecyclerView() {
        ordersAdapter = OrdersAdapter(unassignedOrders) { order ->
            showDriverSelectionDialog(order)
        }
        
        binding.ordersRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@AssignRiderActivity)
            adapter = ordersAdapter
        }
    }

    private fun loadUnassignedOrders() {
        binding.loadingProgress.visibility = View.VISIBLE
        binding.emptyStateText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                // Check if admin is logged in and has a token
                if (!SharedPrefs.isAdminLoggedIn(this@AssignRiderActivity)) {
                    android.util.Log.e("AssignRiderActivity", "Admin not logged in")
                    Toast.makeText(this@AssignRiderActivity, "Please log in as admin", Toast.LENGTH_SHORT).show()
                    binding.emptyStateText.visibility = View.VISIBLE
                    binding.emptyStateText.text = "Please log in as admin"
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    return@launch
                }
                
                val adminToken = SharedPrefs.getAdminToken(this@AssignRiderActivity)
                if (adminToken == null || adminToken.isEmpty()) {
                    android.util.Log.e("AssignRiderActivity", "Admin token is missing")
                    Toast.makeText(this@AssignRiderActivity, "Admin token missing. Please log in again", Toast.LENGTH_SHORT).show()
                    binding.emptyStateText.visibility = View.VISIBLE
                    binding.emptyStateText.text = "Please log in again"
                    binding.loadingProgress.visibility = View.GONE
                    binding.swipeRefresh.isRefreshing = false
                    return@launch
                }
                
                android.util.Log.d("AssignRiderActivity", "Loading unassigned orders with admin token: ${adminToken.take(10)}...")
                
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AssignRiderActivity)
                }
                
                val response = ApiClient.getApiService().getUnassignedOrders()
                
                android.util.Log.d("AssignRiderActivity", "Response code: ${response.code()}, Success: ${response.isSuccessful}")
                
                if (response.isSuccessful && response.body() != null) {
                    val responseBody = response.body()!!
                    unassignedOrders.clear()
                    unassignedOrders.addAll(responseBody.orders)
                    
                    // Update driver order counts
                    responseBody.driverOrderCounts?.forEach { (driverIdStr, count) ->
                        driverOrderCounts[driverIdStr.toIntOrNull() ?: 0] = count
                    }
                    
                    // Count orders with no assigned rider (driverId is null)
                    val noRiderCount = responseBody.orders.count { it.driverId == null }
                    updateUnassignedCount(noRiderCount)
                    
                    ordersAdapter?.notifyDataSetChanged()
                    
                    if (responseBody.orders.isEmpty()) {
                        binding.emptyStateText.visibility = View.VISIBLE
                        binding.emptyStateText.text = "No unassigned orders"
                    } else {
                        binding.emptyStateText.visibility = View.GONE
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    android.util.Log.e("AssignRiderActivity", "Failed to load orders. Code: ${response.code()}, Error: $errorBody")
                    
                    if (response.code() == 401) {
                        Toast.makeText(this@AssignRiderActivity, "Authentication failed. Please log in again", Toast.LENGTH_SHORT).show()
                        binding.emptyStateText.visibility = View.VISIBLE
                        binding.emptyStateText.text = "Authentication failed. Please log in again"
                    } else {
                        Toast.makeText(this@AssignRiderActivity, "Failed to load orders", Toast.LENGTH_SHORT).show()
                        binding.emptyStateText.visibility = View.VISIBLE
                        binding.emptyStateText.text = "Failed to load orders"
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("AssignRiderActivity", "Error loading unassigned orders: ${e.message}", e)
                Toast.makeText(this@AssignRiderActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                binding.emptyStateText.visibility = View.VISIBLE
                binding.emptyStateText.text = "Error loading orders"
                updateUnassignedCount(0) // Reset count on error
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun loadDrivers() {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AssignRiderActivity)
                }
                
                val response = ApiClient.getApiService().getDrivers()
                
                if (response.isSuccessful && response.body() != null) {
                    val apiResponse = response.body()!!
                    if (apiResponse.success == true && apiResponse.data != null) {
                        drivers.clear()
                        drivers.addAll(apiResponse.data!!)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("AssignRiderActivity", "Error loading drivers: ${e.message}", e)
            }
        }
    }

    private fun showDriverSelectionDialog(order: Order) {
        if (drivers.isEmpty()) {
            Toast.makeText(this, "No drivers available", Toast.LENGTH_SHORT).show()
            loadDrivers()
            return
        }

        // Show order details dialog instead of simple driver selection
        showOrderDetailsDialog(order)
    }
    
    private fun showOrderDetailsDialog(order: Order) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_order_details, null)
        
        // Set dark background for the dialog view
        dialogView.setBackgroundColor(getColor(R.color.paper_dark))
        
        // Populate order details
        dialogView.findViewById<android.widget.TextView>(R.id.orderNumberText).text = "Order #${order.id}"
        dialogView.findViewById<android.widget.TextView>(R.id.customerPhoneText).text = order.customerPhone
        dialogView.findViewById<android.widget.TextView>(R.id.customerNameText).text = order.customerName
        dialogView.findViewById<android.widget.TextView>(R.id.territoryText).text = order.territory?.name ?: "N/A"
        dialogView.findViewById<android.widget.TextView>(R.id.deliveryLocationText).text = order.deliveryAddress
        dialogView.findViewById<android.widget.TextView>(R.id.orderDateText).text = order.createdAt ?: "N/A"
        
        // Setup rider dropdown with order counts
        val riderSpinnerLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.riderSpinnerLayout)
        val riderSpinner = dialogView.findViewById<android.widget.Spinner>(R.id.riderSpinner)
        
        // Set hint to "Select Rider" in white
        riderSpinnerLayout.hint = "Select Rider"
        riderSpinnerLayout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(getColor(R.color.text_primary_dark))
        riderSpinnerLayout.boxStrokeColor = getColor(R.color.accent)
        
        // Apply green border
        val strokeColorStateList = android.content.res.ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_enabled),
                intArrayOf(-android.R.attr.state_enabled),
                intArrayOf()
            ),
            intArrayOf(getColor(R.color.accent), getColor(R.color.accent), getColor(R.color.accent), getColor(R.color.accent))
        )
        try {
            val setBoxStrokeColorStateListMethod = riderSpinnerLayout.javaClass.getMethod(
                "setBoxStrokeColorStateList",
                android.content.res.ColorStateList::class.java
            )
            setBoxStrokeColorStateListMethod.invoke(riderSpinnerLayout, strokeColorStateList)
        } catch (e: Exception) {
            riderSpinnerLayout.boxStrokeColor = getColor(R.color.accent)
        }
        
        // Create adapter with "Select Rider" as first item
        val driversWithCounts = mutableListOf<String>()
        driversWithCounts.add("Select Rider")
        driversWithCounts.addAll(drivers.map { driver ->
            "${driver.name} (${driver.phoneNumber})"
        })
        
        val adapter = android.widget.ArrayAdapter(this, R.layout.item_dropdown_dark, driversWithCounts)
        adapter.setDropDownViewResource(R.layout.item_dropdown_dark)
        riderSpinner.adapter = adapter
        
        // Set spinner text color to white
        riderSpinner.setSelection(0) // Default to "Select Rider"
        
        // Set spinner dropdown background to dark
        riderSpinner.setPopupBackgroundDrawable(android.graphics.drawable.ColorDrawable(getColor(R.color.paper_dark)))
        
        // Set current driver if assigned (offset by 1 because "Select Rider" is at index 0)
        order.driverId?.let { driverId ->
            val driverIndex = drivers.indexOfFirst { it.id == driverId }
            if (driverIndex >= 0) {
                riderSpinner.setSelection(driverIndex + 1) // +1 because "Select Rider" is at index 0
            }
        }
        
        // Format date - convert from UTC to local time
        order.createdAt?.let { dateStr ->
            try {
                val utcFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
                utcFormat.timeZone = java.util.TimeZone.getTimeZone("UTC")
                val date = utcFormat.parse(dateStr)
                val displayFormat = java.text.SimpleDateFormat("MMM dd, yyyy HH:mm", java.util.Locale.getDefault())
                displayFormat.timeZone = java.util.TimeZone.getDefault() // Use local timezone
                dialogView.findViewById<android.widget.TextView>(R.id.orderDateText).text = displayFormat.format(date ?: java.util.Date())
            } catch (e: Exception) {
                dialogView.findViewById<android.widget.TextView>(R.id.orderDateText).text = dateStr
            }
        } ?: run {
            dialogView.findViewById<android.widget.TextView>(R.id.orderDateText).text = "N/A"
        }
        
        // Calculate and display subtotal
        val subtotal = order.items?.sumOf { (it.price ?: 0.0) * (it.quantity ?: 0) } ?: 0.0
        
        // Setup delivery fee - calculate from order breakdown if deliveryFee is null or 0
        val deliveryFeeLayout = dialogView.findViewById<com.google.android.material.textfield.TextInputLayout>(R.id.deliveryFeeLayout)
        val deliveryFeeEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.deliveryFeeEditText)
        
        // Apply green border to delivery fee field
        val deliveryFeeStrokeColorStateList = android.content.res.ColorStateList(
            arrayOf(
                intArrayOf(android.R.attr.state_focused),
                intArrayOf(android.R.attr.state_enabled),
                intArrayOf(-android.R.attr.state_enabled),
                intArrayOf()
            ),
            intArrayOf(getColor(R.color.accent), getColor(R.color.accent), getColor(R.color.accent), getColor(R.color.accent))
        )
        try {
            val setBoxStrokeColorStateListMethod = deliveryFeeLayout.javaClass.getMethod(
                "setBoxStrokeColorStateList",
                android.content.res.ColorStateList::class.java
            )
            setBoxStrokeColorStateListMethod.invoke(deliveryFeeLayout, deliveryFeeStrokeColorStateList)
        } catch (e: Exception) {
            deliveryFeeLayout.boxStrokeColor = getColor(R.color.accent)
        }
        
        // Set text color to white
        deliveryFeeEditText.setTextColor(getColor(R.color.text_primary_dark))
        deliveryFeeLayout.defaultHintTextColor = android.content.res.ColorStateList.valueOf(getColor(R.color.text_primary_dark))
        
        val actualDeliveryFee = if (order.deliveryFee != null && order.deliveryFee!! > 0.0) {
            order.deliveryFee!!
        } else {
            // Calculate delivery fee: totalAmount - tipAmount - itemsTotal
            val itemsTotal = order.items?.sumOf { (it.price ?: 0.0) * (it.quantity ?: 0) } ?: 0.0
            val tipAmount = order.tipAmount ?: 0.0
            val totalAmount = order.totalAmount ?: 0.0
            val calculatedFee = kotlin.math.max(totalAmount - tipAmount - itemsTotal, 0.0)
            // Only use calculated fee if it's greater than 0, otherwise keep 0
            if (calculatedFee > 0.0) calculatedFee else 0.0
        }
        deliveryFeeEditText.setText(String.format("%.2f", actualDeliveryFee))
        
        // Setup items list
        val itemsRecyclerView = dialogView.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.itemsRecyclerView)
        itemsRecyclerView.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(this)
        val mutableItems = (order.items ?: emptyList()).toMutableList()
        val tipAmount = order.tipAmount ?: 0.0
        
        // Function to update totals
        val updateTotals = {
            val newSubtotal = mutableItems.sumOf { (it.price ?: 0.0) * (it.quantity ?: 0) }
            dialogView.findViewById<android.widget.TextView>(R.id.subtotalText).text = "KES ${String.format("%.2f", newSubtotal)}"
            
            // Update total including delivery fee
            val deliveryFeeValue = deliveryFeeEditText.text.toString().toDoubleOrNull() ?: actualDeliveryFee
            val totalWithDelivery = newSubtotal + deliveryFeeValue + tipAmount
            dialogView.findViewById<android.widget.TextView>(R.id.totalWithDeliveryText).text = "KES ${String.format("%.2f", totalWithDelivery)}"
        }
        
        val itemsAdapter = OrderItemsAdapter(mutableItems) { item, newPrice ->
            // Update item price in the list
            val itemIndex = mutableItems.indexOfFirst { it.id == item.id }
            if (itemIndex >= 0) {
                mutableItems[itemIndex] = item.copy(price = newPrice)
            }
            updateTotals()
        }
        itemsRecyclerView.adapter = itemsAdapter
        
        // Display initial subtotal
        dialogView.findViewById<android.widget.TextView>(R.id.subtotalText).text = "KES ${String.format("%.2f", subtotal)}"
        
        // Setup total including delivery fee
        val totalWithDelivery = subtotal + actualDeliveryFee + tipAmount
        dialogView.findViewById<android.widget.TextView>(R.id.totalWithDeliveryText).text = "KES ${String.format("%.2f", totalWithDelivery)}"
        
        // Update total when delivery fee changes
        deliveryFeeEditText.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val deliveryFeeValue = s.toString().toDoubleOrNull() ?: 0.0
                val currentSubtotal = mutableItems.sumOf { (it.price ?: 0.0) * (it.quantity ?: 0) }
                val totalWithDelivery = currentSubtotal + deliveryFeeValue + tipAmount
                dialogView.findViewById<android.widget.TextView>(R.id.totalWithDeliveryText).text = "KES ${String.format("%.2f", totalWithDelivery)}"
            }
        })
        
        // Setup buttons
        val cancelButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.cancelOrderButton)
        val updateButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.updateOrderButton)
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setView(dialogView)
            .setTitle("Order Details")
            .setNegativeButton("Close", null)
            .create()
        
        cancelButton.setOnClickListener {
            showCancelOrderConfirmation(order, dialog)
        }
        
        updateButton.setOnClickListener {
            val selectedDriverIndex = riderSpinner.selectedItemPosition
            // Account for "Select Rider" at index 0, so actual driver index is selectedDriverIndex - 1
            val selectedDriver = if (selectedDriverIndex > 0 && (selectedDriverIndex - 1) < drivers.size) {
                drivers[selectedDriverIndex - 1]
            } else {
                null
            }
            val newDeliveryFee = deliveryFeeEditText.text.toString().toDoubleOrNull() ?: order.deliveryFee ?: 0.0
            
            // Update item prices if changed
            val itemsToUpdate = mutableListOf<Pair<Int, Double>>() // itemId to newPrice
            for (i in 0 until itemsRecyclerView.childCount) {
                val itemView = itemsRecyclerView.getChildAt(i)
                val itemId = itemView.tag as? Int ?: continue
                val priceEditText = itemView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.itemPriceEditText)
                val newPrice = priceEditText.text.toString().toDoubleOrNull()
                if (newPrice != null) {
                    val originalItem = order.items?.find { it.id == itemId }
                    if (originalItem != null && kotlin.math.abs((newPrice - (originalItem.price ?: 0.0))) > 0.01) {
                        itemsToUpdate.add(Pair(itemId, newPrice))
                    }
                }
            }
            
            updateOrder(order, selectedDriver, newDeliveryFee, itemsToUpdate, dialog)
        }
        
        dialog.show()
    }
    
    private fun showCancelOrderConfirmation(order: Order, parentDialog: AlertDialog) {
        AlertDialog.Builder(this, R.style.Theme_DialADrinkDriver_AlertDialog)
            .setTitle("Cancel Order")
            .setMessage("Are you sure you want to cancel Order #${order.id}?")
            .setPositiveButton("Cancel Order") { _, _ ->
                cancelOrder(order, parentDialog)
            }
            .setNegativeButton("No", null)
            .show()
    }
    
    private fun cancelOrder(order: Order, parentDialog: AlertDialog) {
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AssignRiderActivity)
                }
                
                // Call cancel order endpoint
                val response = ApiClient.getApiService().updateAdminOrderStatus(
                    order.id,
                    UpdateOrderStatusRequest(status = "cancelled", driverId = order.driverId ?: 0)
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(this@AssignRiderActivity, "Order cancelled", Toast.LENGTH_SHORT).show()
                    parentDialog.dismiss()
                    loadUnassignedOrders()
                } else {
                    Toast.makeText(this@AssignRiderActivity, "Failed to cancel order", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                android.util.Log.e("AssignRiderActivity", "Error cancelling order: ${e.message}", e)
                Toast.makeText(this@AssignRiderActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }
    
    private fun updateOrder(order: Order, driver: Driver?, deliveryFee: Double, itemsToUpdate: List<Pair<Int, Double>>, parentDialog: AlertDialog) {
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AssignRiderActivity)
                }
                
                // Update item prices first
                for ((itemId, newPrice) in itemsToUpdate) {
                    try {
                        val response = ApiClient.getApiService().updateOrderItemPrice(order.id, itemId, UpdateItemPriceRequest(price = newPrice))
                        if (!response.isSuccessful) {
                            android.util.Log.w("AssignRiderActivity", "Failed to update item $itemId price")
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("AssignRiderActivity", "Error updating item price: ${e.message}", e)
                    }
                }
                
                // Assign driver if selected
                if (driver != null) {
                    val request = AssignDriverRequest(driverId = driver.id)
                    val response = ApiClient.getApiService().assignDriverToOrder(order.id, request)
                    
                    if (!response.isSuccessful || response.body()?.success != true) {
                        Toast.makeText(this@AssignRiderActivity, "Failed to assign rider", Toast.LENGTH_SHORT).show()
                        binding.loadingProgress.visibility = View.GONE
                        return@launch
                    }
                }
                
                // Update delivery fee if changed
                if (kotlin.math.abs((deliveryFee - (order.deliveryFee ?: 0.0))) > 0.01) {
                    val updateResponse = ApiClient.getApiService().updateOrderDeliveryFee(order.id, UpdateDeliveryFeeRequest(deliveryFee = deliveryFee))
                    if (!updateResponse.isSuccessful || updateResponse.body()?.success != true) {
                        Toast.makeText(this@AssignRiderActivity, "Failed to update delivery fee", Toast.LENGTH_SHORT).show()
                    }
                }
                
                Toast.makeText(this@AssignRiderActivity, "Order updated successfully", Toast.LENGTH_SHORT).show()
                parentDialog.dismiss()
                loadUnassignedOrders()
            } catch (e: Exception) {
                android.util.Log.e("AssignRiderActivity", "Error updating order: ${e.message}", e)
                Toast.makeText(this@AssignRiderActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }

    private fun assignDriverToOrder(order: Order, driver: Driver) {
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@AssignRiderActivity)
                }
                
                val request = AssignDriverRequest(driverId = driver.id)
                val response = ApiClient.getApiService().assignDriverToOrder(order.id, request)
                
                if (response.isSuccessful && response.body() != null) {
                    val apiResponse = response.body()!!
                    if (apiResponse.success == true) {
                        Toast.makeText(this@AssignRiderActivity, "Rider assigned successfully", Toast.LENGTH_SHORT).show()
                        // Refresh the list to show updated driver status
                        // Order will still appear if driver hasn't accepted yet
                        loadUnassignedOrders()
                    } else {
                        Toast.makeText(this@AssignRiderActivity, apiResponse.error ?: "Failed to assign rider", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(this@AssignRiderActivity, "Failed to assign rider", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                android.util.Log.e("AssignRiderActivity", "Error assigning driver: ${e.message}", e)
                Toast.makeText(this@AssignRiderActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }

    private class OrdersAdapter(
        private val orders: List<Order>,
        private val onOrderClick: (Order) -> Unit
    ) : androidx.recyclerview.widget.RecyclerView.Adapter<OrdersAdapter.OrderViewHolder>() {
        
        override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): OrderViewHolder {
            val view = android.view.LayoutInflater.from(parent.context)
                .inflate(R.layout.item_unassigned_order, parent, false)
            return OrderViewHolder(view)
        }

        override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
            holder.bind(orders[position], onOrderClick)
        }

        override fun getItemCount() = orders.size

        class OrderViewHolder(itemView: View) : androidx.recyclerview.widget.RecyclerView.ViewHolder(itemView) {
            fun bind(order: Order, onOrderClick: (Order) -> Unit) {
                itemView.findViewById<android.widget.TextView>(R.id.orderIdText).text = "Order #${order.id}"
                
                // Format date
                val dateText = itemView.findViewById<android.widget.TextView>(R.id.orderDateText)
                order.createdAt?.let { dateStr ->
                    try {
                        val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.getDefault())
                        val date = dateFormat.parse(dateStr)
                        val displayFormat = java.text.SimpleDateFormat("MMM dd, yyyy HH:mm", java.util.Locale.getDefault())
                        dateText.text = displayFormat.format(date ?: java.util.Date())
                    } catch (e: Exception) {
                        dateText.text = dateStr
                    }
                } ?: run {
                    dateText.text = "N/A"
                }
                
                itemView.findViewById<android.widget.TextView>(R.id.customerPhoneText).text = order.customerPhone
                itemView.findViewById<android.widget.TextView>(R.id.territoryText).text = "Territory: ${order.territory?.name ?: "N/A"}"
                itemView.findViewById<android.widget.TextView>(R.id.deliveryAddressText).text = order.deliveryAddress
                itemView.findViewById<android.widget.TextView>(R.id.totalAmountText).text = "KES ${String.format("%.2f", order.totalAmount)}"
                
                // Show driver status if driver is assigned but hasn't accepted
                val driverStatusText = itemView.findViewById<android.widget.TextView>(R.id.driverStatusText)
                if (order.driverId != null && order.driverId != 0) {
                    if (order.driverAccepted == null || order.driverAccepted == false) {
                        driverStatusText.visibility = View.VISIBLE
                        driverStatusText.text = "Driver assigned - Pending acceptance"
                        driverStatusText.setTextColor(itemView.context.getColor(android.R.color.holo_orange_dark))
                    } else {
                        driverStatusText.visibility = View.GONE
                    }
                } else {
                    driverStatusText.visibility = View.GONE
                }
                
                itemView.setOnClickListener {
                    onOrderClick(order)
                }
            }
        }
    }
    
    private class OrderItemsAdapter(
        private val items: MutableList<OrderItem>,
        private val onPriceChanged: (OrderItem, Double) -> Unit
    ) : androidx.recyclerview.widget.RecyclerView.Adapter<OrderItemsAdapter.ItemViewHolder>() {
        
        override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): ItemViewHolder {
            val view = android.view.LayoutInflater.from(parent.context)
                .inflate(R.layout.item_order_detail_item, parent, false)
            return ItemViewHolder(view)
        }

        override fun onBindViewHolder(holder: ItemViewHolder, position: Int) {
            holder.bind(items[position], onPriceChanged)
        }

        override fun getItemCount() = items.size

        class ItemViewHolder(itemView: View) : androidx.recyclerview.widget.RecyclerView.ViewHolder(itemView) {
            fun bind(item: OrderItem, onPriceChanged: (OrderItem, Double) -> Unit) {
                itemView.tag = item.id
                
                val itemNameText = itemView.findViewById<android.widget.TextView>(R.id.itemNameText)
                val itemQuantityText = itemView.findViewById<android.widget.TextView>(R.id.itemQuantityText)
                val itemPriceEditText = itemView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.itemPriceEditText)
                
                itemNameText.text = item.drink?.name ?: "Item ${item.drinkId}"
                itemQuantityText.text = "Qty: ${item.quantity}"
                itemPriceEditText.setText(String.format("%.2f", item.price ?: 0.0))
                
                // Update when price changes
                itemPriceEditText.addTextChangedListener(object : android.text.TextWatcher {
                    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                    override fun afterTextChanged(s: Editable?) {
                        val newPrice = s.toString().toDoubleOrNull() ?: 0.0
                        onPriceChanged(item, newPrice)
                    }
                })
            }
        }
    }
}
