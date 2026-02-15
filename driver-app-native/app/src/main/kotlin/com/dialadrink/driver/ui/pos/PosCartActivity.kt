package com.dialadrink.driver.ui.pos

import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityPosCartBinding
// Removed Google Places SDK imports - now using backend API for cost savings
import com.google.android.material.textfield.TextInputEditText
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import android.content.SharedPreferences
import androidx.preference.PreferenceManager
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class PosCartActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPosCartBinding
    private val cart = mutableListOf<PosCartItem>()
    private val territories = mutableListOf<Territory>()
    private var selectedTerritory: Territory? = null
    private var selectedPaymentMethod: String? = null
    private val paymentMethods = listOf("Pay on Delivery", "Swipe on Delivery", "Already Paid")
    private lateinit var paymentMethodAdapter: ArrayAdapter<String>
    private var customerExists = false
    private var isWalkIn = false
    private var isStaffPurchase = false
    private val orderTypes = listOf("Walk-in", "Delivery")
    private var customerName = ""
    private var customerEmail = ""
    private var isSettingCustomerFromAutocomplete = false
    private lateinit var adapter: CartAdapter
    private val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
    private val phoneCheckHandler = Handler(Looper.getMainLooper())
    private var phoneCheckRunnable: Runnable? = null
    private val addressCheckHandler = Handler(Looper.getMainLooper())
    private var addressCheckRunnable: Runnable? = null
    private val addressSuggestions = mutableListOf<AddressSuggestion>()
    private var addressAdapter: ArrayAdapter<String>? = null
    private var isSelectingFromAutocomplete = false
    private val customerSuggestions = mutableListOf<PosCustomer>()
    private var customerPhoneAdapter: ArrayAdapter<String>? = null
    private val drivers = mutableListOf<Driver>()
    private var selectedDriver: Driver? = null
    private lateinit var driverAdapter: ArrayAdapter<String>

    companion object {
        const val CART_EXTRA = "cart"
        private const val PREFS_CART = "pos_cart_items"
        private const val PREFS_CUSTOMER_PHONE = "pos_customer_phone"
        private const val PREFS_DELIVERY_ADDRESS = "pos_delivery_address"
        private const val PREFS_TERRITORY_ID = "pos_territory_id"
        private const val PREFS_PAYMENT_METHOD = "pos_payment_method"
    }
    
    private val gson = Gson()
    private val cartType = object : TypeToken<List<PosCartItem>>() {}.type
    private lateinit var sharedPrefs: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        android.util.Log.d("PosCartActivity", "🚀 onCreate called")
        binding = ActivityPosCartBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)

        // Initialize SharedPreferences for cart persistence
        sharedPrefs = PreferenceManager.getDefaultSharedPreferences(this)
        android.util.Log.d("PosCartActivity", "📱 SharedPreferences initialized")

        // Always restore cart from SharedPreferences first (persistent state)
        restoreCartFromPrefs()
        android.util.Log.d("PosCartActivity", "📦 Restored cart from prefs: ${cart.size} items")
        
        // Then merge with intent data if present (new items from product list)
        val cartItems = intent.getParcelableArrayListExtra<PosCartItem>(CART_EXTRA)
        if (cartItems != null && cartItems.isNotEmpty()) {
            android.util.Log.d("PosCartActivity", "📦 Cart received from intent: ${cartItems.size} items")
            // Merge intent cart with saved cart (add new items, update quantities)
            for (intentItem in cartItems) {
                val existingItem = cart.find { it.drinkId == intentItem.drinkId && it.capacity == intentItem.capacity }
                if (existingItem != null) {
                    // Update quantity if item already exists
                    existingItem.quantity = intentItem.quantity
                } else {
                    // Add new item
                    cart.add(intentItem)
                }
            }
            // Save merged cart to SharedPreferences
            saveCartToPrefs()
        }
        
        // Restore other form fields
        restoreFormFields()
        
        setupRecyclerView()
        setupListeners()
        loadTerritories()
        // Setup order type spinner
        setupOrderTypeSpinner()
        
        // Setup payment method spinner
        setupPaymentMethodSpinner()
        
        // Update UI after everything is set up
        adapter.notifyDataSetChanged()
        updateTotals()
    }
    
    override fun onResume() {
        super.onResume()
        android.util.Log.d("PosCartActivity", "🔄 onResume called, cart size: ${cart.size}")
        // Restore cart if it's empty (activity was paused but not destroyed)
        // This handles the case where user navigates away and comes back without activity being destroyed
        if (cart.isEmpty()) {
            android.util.Log.d("PosCartActivity", "📦 Cart is empty in onResume, restoring from prefs...")
            restoreCartFromPrefs()
            if (cart.isNotEmpty()) {
                restoreFormFields()
                adapter.notifyDataSetChanged()
                updateTotals()
                android.util.Log.d("PosCartActivity", "✅ Cart restored in onResume: ${cart.size} items")
            }
        }
    }
    
    override fun onPause() {
        super.onPause()
        android.util.Log.d("PosCartActivity", "⏸️ onPause called, saving cart with ${cart.size} items")
        // Save cart and form state when navigating away
        saveCartToPrefs()
        saveFormFields()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Clean up handlers to prevent memory leaks
        phoneCheckRunnable?.let { phoneCheckHandler.removeCallbacks(it) }
        addressCheckRunnable?.let { addressCheckHandler.removeCallbacks(it) }
    }
    
    private fun saveCartToPrefs() {
        try {
            val json = gson.toJson(cart)
            val success = sharedPrefs.edit().putString(PREFS_CART, json).commit()
            android.util.Log.d("PosCartActivity", "✅ Cart saved to prefs: ${cart.size} items, success=$success")
        } catch (e: Exception) {
            android.util.Log.e("PosCartActivity", "❌ Error saving cart to prefs: ${e.message}", e)
        }
    }
    
    private fun restoreCartFromPrefs() {
        try {
            val json = sharedPrefs.getString(PREFS_CART, null)
            if (json != null && json.isNotEmpty()) {
                val savedCart: List<PosCartItem> = gson.fromJson(json, cartType)
                cart.clear()
                cart.addAll(savedCart)
                android.util.Log.d("PosCartActivity", "✅ Cart restored from prefs: ${cart.size} items")
            } else {
                android.util.Log.d("PosCartActivity", "ℹ️ No cart data found in prefs")
            }
        } catch (e: Exception) {
            android.util.Log.e("PosCartActivity", "❌ Error restoring cart from prefs: ${e.message}", e)
        }
    }
    
    private fun saveFormFields() {
        try {
            sharedPrefs.edit()
                .putString(PREFS_CUSTOMER_PHONE, binding.customerPhoneEditText.text?.toString() ?: "")
                .putString(PREFS_DELIVERY_ADDRESS, binding.deliveryAddressEditText.text?.toString() ?: "")
                .putInt(PREFS_TERRITORY_ID, selectedTerritory?.id ?: -1)
                .putString(PREFS_PAYMENT_METHOD, selectedPaymentMethod ?: "")
                .apply()
        } catch (e: Exception) {
            android.util.Log.e("PosCartActivity", "Error saving form fields: ${e.message}", e)
        }
    }
    
    private fun restoreFormFields() {
        try {
            val phone = sharedPrefs.getString(PREFS_CUSTOMER_PHONE, "")
            if (phone?.isNotEmpty() == true) {
                binding.customerPhoneEditText.setText(phone)
            }
            
            val address = sharedPrefs.getString(PREFS_DELIVERY_ADDRESS, "")
            if (address?.isNotEmpty() == true) {
                binding.deliveryAddressEditText.setText(address)
            }
            
            val territoryId = sharedPrefs.getInt(PREFS_TERRITORY_ID, -1)
            if (territoryId != -1) {
                // Territory will be set after territories are loaded
            }
            
            val paymentMethod = sharedPrefs.getString(PREFS_PAYMENT_METHOD, "")
            if (paymentMethod?.isNotEmpty() == true) {
                selectedPaymentMethod = paymentMethod
                val selectionIndex = when (paymentMethod) {
                    "pay_on_delivery" -> 0
                    "swipe_on_delivery" -> 1
                    "already_paid" -> 2
                    "cash" -> 2 // Map old "cash" to "Already Paid"
                    else -> 0
                }
                binding.paymentMethodSpinner.setSelection(selectionIndex)
            }
        } catch (e: Exception) {
            android.util.Log.e("PosCartActivity", "Error restoring form fields: ${e.message}", e)
        }
    }
    
    private fun clearCartFromPrefs() {
        sharedPrefs.edit()
            .remove(PREFS_CART)
            .remove(PREFS_CUSTOMER_PHONE)
            .remove(PREFS_DELIVERY_ADDRESS)
            .remove(PREFS_TERRITORY_ID)
            .remove(PREFS_PAYMENT_METHOD)
            .apply()
    }
    
    private fun clearCartAndFormFields() {
        // Clear cart
        cart.clear()
        clearCartFromPrefs()
        
        // Clear form fields in UI
        binding.customerPhoneEditText.setText("")
        binding.deliveryAddressEditText.setText("")
        binding.paymentMethodSpinner.setSelection(0) // Reset to "Pay on Delivery"
        binding.territoryEditText.setText("")
        binding.deliveryFeeEditText.setText("")
        if (binding.orderTypeSpinner.adapter != null && binding.orderTypeSpinner.count > 0) {
            binding.orderTypeSpinner.setSelection(0) // Reset to first option
        }
        
        // Clear selected values
        selectedTerritory = null
        selectedPaymentMethod = "pay_on_delivery"
        customerName = ""
        customerEmail = ""
        customerExists = false
        isWalkIn = false
        
        // Update UI
        adapter.notifyDataSetChanged()
        updateTotals()
    }

    override fun onSupportNavigateUp(): Boolean {
        val resultIntent = Intent()
        resultIntent.putParcelableArrayListExtra(CART_EXTRA, ArrayList(cart))
        setResult(RESULT_OK, resultIntent)
        finish()
        return true
    }

    private fun setupRecyclerView() {
        adapter = CartAdapter(cart) { item, action ->
            when (action) {
                CartAction.INCREASE -> increaseQuantity(item)
                CartAction.DECREASE -> decreaseQuantity(item)
                CartAction.DELETE -> deleteItem(item)
            }
        }
        binding.cartItemsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.cartItemsRecyclerView.adapter = adapter
    }

    private fun setupListeners() {
        binding.addItemsButton.setOnClickListener {
            val resultIntent = Intent()
            resultIntent.putParcelableArrayListExtra(CART_EXTRA, ArrayList(cart))
            setResult(RESULT_OK, resultIntent)
            finish()
        }

        // Setup customer phone autocomplete
        setupCustomerPhoneAutocomplete()
        
        // Setup Staff Purchase checkbox
        binding.staffPurchaseCheckbox.setOnCheckedChangeListener { _, isChecked ->
            isStaffPurchase = isChecked
            if (isChecked) {
                // Hide create customer button immediately when Staff Purchase is checked
                binding.createCustomerButton.visibility = View.GONE
                // Load drivers first, then setup dropdown
                loadDrivers()
                // Setup driver dropdown immediately (will show "Select Driver" placeholder)
                setupDriverDropdown()
                setupStaffPurchasePaymentMethods()
            } else {
                // Switch back to customer phone field
                setupCustomerPhoneField()
                setupPaymentMethodSpinner() // Reset to normal payment methods
                // Re-check customer to update button visibility
                val phone = binding.customerPhoneEditText.text.toString().trim()
                if (phone.isNotEmpty()) {
                    checkCustomer(phone)
                }
            }
        }

        binding.createCustomerButton.setOnClickListener {
            showCreateCustomerDialog()
        }

        binding.territoryEditText.setOnClickListener {
            showTerritoryDialog()
        }

        // Payment method spinner selection handler
        binding.paymentMethodSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                selectedPaymentMethod = if (isStaffPurchase) {
                    // Staff Purchase: "Cash" or "Cash at Hand"
                    when (position) {
                        0 -> "cash"
                        1 -> "cash_at_hand"
                        else -> "cash"
                    }
                } else {
                    // Regular payment methods
                    when (position) {
                        0 -> "pay_on_delivery"
                        1 -> "swipe_on_delivery"
                        2 -> "already_paid"
                        else -> "pay_on_delivery"
                    }
                }
                // If walk-in and payment method is "Pay on Delivery" (cash), set phone number
                if (isWalkIn && selectedPaymentMethod == "pay_on_delivery" && !isStaffPurchase) {
                    updatePhoneNumberForWalkInCash()
                }
                saveFormFields() // Save payment method selection
            }

            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {
                // Do nothing
            }
        }

        binding.deliveryFeeEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                updateTotals()
            }
        })

        // Setup inline Google Places Autocomplete for delivery address
        setupAddressAutocomplete()

        binding.submitOrderButton.setOnClickListener {
            submitOrder()
        }
    }
    
    private fun setupCustomerPhoneAutocomplete() {
        // Create adapter for customer phone autocomplete
        customerPhoneAdapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, mutableListOf())
        binding.customerPhoneEditText.setAdapter(customerPhoneAdapter)
        
        // Handle text changes to format phone and search for customers
        binding.customerPhoneEditText.addTextChangedListener(object : TextWatcher {
            private var isFormatting = false
            
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (isFormatting) return
                
                // Skip processing if we're setting text from autocomplete selection
                if (isSettingCustomerFromAutocomplete) {
                    return
                }
                
                val phone = s.toString().trim()
                if (phone.isEmpty()) {
                    customerExists = false
                    // Hide button if Staff Purchase is enabled, otherwise hide if empty
                    binding.createCustomerButton.visibility = if (isStaffPurchase) View.GONE else View.GONE
                    customerPhoneAdapter?.clear()
                    customerPhoneAdapter?.notifyDataSetChanged()
                    return
                }
                
                // If Staff Purchase is enabled, don't check customer
                if (isStaffPurchase) {
                    binding.createCustomerButton.visibility = View.GONE
                    return
                }
                
                customerExists = false
                
                // Format phone: if starts with 0, replace with 254
                var formattedPhone = phone
                if (phone.startsWith("0") && phone.length >= 2) {
                    formattedPhone = "254" + phone.substring(1)
                    if (formattedPhone != phone) {
                        isFormatting = true
                        binding.customerPhoneEditText.setText(formattedPhone)
                        binding.customerPhoneEditText.setSelection(formattedPhone.length)
                        isFormatting = false
                    }
                }
                
                // Search for customers if phone is long enough
                if (formattedPhone.length >= 3) {
                    searchCustomers(formattedPhone)
                } else {
                    customerPhoneAdapter?.clear()
                    customerPhoneAdapter?.notifyDataSetChanged()
                }
                
                // Check if customer exists (for existing customer lookup)
                if (formattedPhone.length >= 9) {
                    checkCustomer(formattedPhone)
                } else {
                    customerExists = false
                    binding.createCustomerButton.visibility = View.GONE
                }
            }
        })
        
        // Handle item selection
        binding.customerPhoneEditText.setOnItemClickListener { _, _, position, _ ->
            val customer = customerSuggestions.getOrNull(position)
            if (customer != null && customer.phone != null) {
                val selectedPhone = customer.phone
                
                // Set flag to prevent text change listener from interfering
                isSettingCustomerFromAutocomplete = true
                
                binding.customerPhoneEditText.setText(selectedPhone)
                customerName = customer.name ?: ""
                customerEmail = customer.email ?: ""
                customerExists = true
                binding.createCustomerButton.visibility = View.GONE
                
                // Reset flag after a short delay to allow text to be set
                binding.customerPhoneEditText.post {
                    isSettingCustomerFromAutocomplete = false
                }
                
                // Verify customer exists by calling checkCustomer (but preserve state if already confirmed)
                checkCustomer(selectedPhone)
                
                binding.customerPhoneEditText.clearFocus()
            }
        }
    }
    
    private fun searchCustomers(query: String) {
        // Cancel previous search
        phoneCheckRunnable?.let { phoneCheckHandler.removeCallbacks(it) }
        
        // Debounce search (wait 300ms after user stops typing)
        phoneCheckRunnable = Runnable {
            lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(this@PosCartActivity)
                    }
                    
                    val response = ApiClient.getApiService().searchCustomers(query)
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        val customers = response.body()!!.data ?: emptyList()
                        customerSuggestions.clear()
                        customerSuggestions.addAll(customers)
                        
                        // Format suggestions as "Name - Phone"
                        val suggestions = customers.map { customer ->
                            val name = customer.name ?: "Unknown"
                            val phone = customer.phone ?: ""
                            "$name - $phone"
                        }
                        
                        customerPhoneAdapter?.clear()
                        customerPhoneAdapter?.addAll(suggestions)
                        customerPhoneAdapter?.notifyDataSetChanged()
                    } else {
                        customerPhoneAdapter?.clear()
                        customerPhoneAdapter?.notifyDataSetChanged()
                    }
                } catch (e: Exception) {
                    android.util.Log.e("PosCartActivity", "Error searching customers: ${e.message}", e)
                }
            }
        }
        phoneCheckHandler.postDelayed(phoneCheckRunnable!!, 300)
    }
    
    private fun setupAddressAutocomplete() {
        // Create adapter for autocomplete suggestions
        addressAdapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, mutableListOf())
        binding.deliveryAddressEditText.setAdapter(addressAdapter)
        
        // Handle text changes to fetch autocomplete predictions
        binding.deliveryAddressEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                // Skip if we're setting text from autocomplete selection
                if (isSelectingFromAutocomplete) {
                    return
                }
                
                val query = s.toString().trim()
                // Fetch suggestions starting from 2nd letter (like customer site)
                if (query.length >= 2) {
                    fetchAddressSuggestions(query)
                } else {
                    addressAdapter?.clear()
                    addressAdapter?.notifyDataSetChanged()
                }
            }
        })
        
        // Handle item selection
        binding.deliveryAddressEditText.setOnItemClickListener { _, _, position, _ ->
            val suggestion = addressSuggestions.getOrNull(position)
            if (suggestion != null) {
                isSelectingFromAutocomplete = true
                val addressText = suggestion.description
                binding.deliveryAddressEditText.setText(addressText)
                binding.deliveryAddressEditText.clearFocus()
                
                // Reset flag after a short delay
                binding.deliveryAddressEditText.post {
                    isSelectingFromAutocomplete = false
                }
                
                // Fetch place details if placeId exists (but don't overwrite the address)
                if (suggestion.placeId != null) {
                    fetchPlaceDetails(suggestion.placeId!!, shouldUpdateAddress = false)
                }
                
                // Save address to database if not already from database (for cost savings)
                if (suggestion.fromDatabase != true && addressText.isNotEmpty()) {
                    saveAddressToDatabase(suggestion)
                }
            }
        }
    }
    
    private fun fetchAddressSuggestions(query: String) {
        // Cancel previous search
        addressCheckRunnable?.let { addressCheckHandler.removeCallbacks(it) }
        
        addressCheckRunnable = Runnable {
            lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(this@PosCartActivity)
                    }
                    
                    val request = PlacesAutocompleteRequest(input = query)
                    val response = ApiClient.getApiService().getAddressSuggestions(request)
                    
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        
                        if (body.error != null) {
                            android.util.Log.e("PosCartActivity", "Places API error: ${body.error}")
                            return@launch
                        }
                        
                        val suggestions = body.suggestions ?: emptyList()
                        addressSuggestions.clear()
                        addressSuggestions.addAll(suggestions)
                        
                        // Update adapter with suggestion descriptions
                        val suggestionTexts = suggestions.map { it.description }
                        addressAdapter?.clear()
                        addressAdapter?.addAll(suggestionTexts)
                        addressAdapter?.notifyDataSetChanged()
                        
                        android.util.Log.d("PosCartActivity", "Fetched ${suggestions.size} address suggestions (fromDatabase: ${body.fromDatabase}, hasGoogleResults: ${body.hasGoogleResults})")
                    } else {
                        android.util.Log.e("PosCartActivity", "Failed to fetch address suggestions: ${response.code()}")
                        addressAdapter?.clear()
                        addressAdapter?.notifyDataSetChanged()
                    }
                } catch (e: Exception) {
                    android.util.Log.e("PosCartActivity", "Error fetching address suggestions: ${e.message}", e)
                    addressAdapter?.clear()
                    addressAdapter?.notifyDataSetChanged()
                }
            }
        }
        // Increase debounce delay to 500ms to reduce API calls and improve UX
        addressCheckHandler.postDelayed(addressCheckRunnable!!, 500)
    }
    
    private fun fetchPlaceDetails(placeId: String, shouldUpdateAddress: Boolean = false) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getPlaceDetails(placeId)
                
                if (response.isSuccessful && response.body() != null) {
                    val placeDetails = response.body()!!
                    // Only update address if explicitly requested (e.g., when user selects from dropdown)
                    // This prevents the address from being overwritten to "nairobi city" when user is typing
                    if (shouldUpdateAddress) {
                        val address = placeDetails.formatted_address ?: placeDetails.name ?: ""
                        if (address.isNotEmpty() && !isSelectingFromAutocomplete) {
                            isSelectingFromAutocomplete = true
                            binding.deliveryAddressEditText.setText(address)
                            binding.deliveryAddressEditText.clearFocus()
                            binding.deliveryAddressEditText.post {
                                isSelectingFromAutocomplete = false
                            }
                        }
                    }
                } else {
                    android.util.Log.e("PosCartActivity", "Failed to fetch place details: ${response.code()}")
                    // Don't show error toast as this is a background operation
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error fetching place details: ${e.message}", e)
                // Don't show error toast as this is a background operation
            }
        }
    }
    
    private fun saveAddressToDatabase(suggestion: AddressSuggestion) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val request = SaveAddressRequest(
                    address = suggestion.description,
                    placeId = suggestion.placeId,
                    formattedAddress = suggestion.description
                )
                
                ApiClient.getApiService().saveAddress(request)
                android.util.Log.d("PosCartActivity", "Saved address to database: ${suggestion.description}")
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error saving address to database: ${e.message}", e)
                // Don't block user flow if save fails
            }
        }
    }

    private fun increaseQuantity(item: PosCartItem) {
        if (item.quantity >= item.availableStock) {
            Toast.makeText(this, "Cannot add more. Stock is ${item.availableStock} for ${item.name}", Toast.LENGTH_SHORT).show()
            return
        }
        item.quantity++
        adapter.notifyDataSetChanged()
        updateTotals()
        saveCartToPrefs() // Persist cart changes
    }

    private fun decreaseQuantity(item: PosCartItem) {
        if (item.quantity > 1) {
            item.quantity--
            adapter.notifyDataSetChanged()
            updateTotals()
            saveCartToPrefs() // Persist cart changes
            
            // Restore stock for the item that was removed
            restoreStock(item.drinkId, 1)
        }
    }

    private fun deleteItem(item: PosCartItem) {
        val quantityToRestore = item.quantity
        cart.remove(item)
        adapter.notifyDataSetChanged()
        updateTotals()
        saveCartToPrefs() // Persist cart changes
        
        // Restore stock for all items that were removed
        restoreStock(item.drinkId, quantityToRestore)
        
        if (cart.isEmpty()) {
            Toast.makeText(this, "Cart is empty", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun restoreStock(drinkId: Int, quantity: Int) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val request = AddStockRequest(
                    drinkId = drinkId,
                    quantity = quantity
                )
                
                val response = ApiClient.getApiService().addStock(request)
                if (response.isSuccessful && response.body()?.success == true) {
                    val body = response.body()
                    android.util.Log.d("PosCartActivity", "✅ Stock restored: drinkId=$drinkId, quantity=$quantity, newStock=${body?.newStock}")
                } else {
                    val errorMessage = response.body()?.message ?: response.message() ?: "Unknown error"
                    android.util.Log.e("PosCartActivity", "❌ Failed to restore stock: $errorMessage")
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error restoring stock: ${e.message}", e)
                // Don't show error to user - stock restoration is a background operation
            }
        }
    }

    private fun checkCustomer(phone: String) {
        // If Staff Purchase is enabled, always hide the button
        if (isStaffPurchase) {
            binding.createCustomerButton.visibility = View.GONE
            return
        }
        
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getPosCustomer(phone)
                
                android.util.Log.d("PosCartActivity", "Customer check response: code=${response.code()}, isSuccessful=${response.isSuccessful}")
                
                if (response.isSuccessful) {
                    val responseBody = response.body()
                    android.util.Log.d("PosCartActivity", "Response body: $responseBody")
                    
                    // The backend returns { customer: {...} } or { customer: null }
                    val customer = responseBody?.customer
                    
                    // Customer exists if the customer object is not null and has data
                    customerExists = customer != null && (customer.name != null || customer.phone != null)
                    
                    android.util.Log.d("PosCartActivity", "Customer check result: exists=$customerExists, customer=$customer")
                    
                    // Double-check Staff Purchase hasn't been enabled while we were checking
                    if (isStaffPurchase) {
                        binding.createCustomerButton.visibility = View.GONE
                    } else if (customerExists && customer != null) {
                        // Update customer info
                        customerName = customer.name ?: ""
                        customerEmail = customer.email ?: ""
                        android.util.Log.d("PosCartActivity", "Customer exists: $customerName, hiding create button")
                        binding.createCustomerButton.visibility = View.GONE
                    } else {
                        customerExists = false
                        android.util.Log.d("PosCartActivity", "Customer does not exist (customer=$customer), showing create button")
                        binding.createCustomerButton.visibility = View.VISIBLE
                    }
                } else {
                    // Customer not found or error
                    customerExists = false
                    val errorBody = response.errorBody()?.string()
                    android.util.Log.d("PosCartActivity", "Customer check failed: code=${response.code()}, errorBody=$errorBody, showing create button")
                    // Only show button if not Staff Purchase
                    if (!isStaffPurchase) {
                        binding.createCustomerButton.visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error checking customer: ${e.message}", e)
                customerExists = false
                // Only show button if not Staff Purchase
                if (!isStaffPurchase) {
                    binding.createCustomerButton.visibility = View.VISIBLE
                }
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }

    private fun showCreateCustomerDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_customer, null)
        val nameEditText = dialogView.findViewById<TextInputEditText>(R.id.nameEditText)
        val phoneEditText = dialogView.findViewById<TextInputEditText>(R.id.phoneEditText)
        val emailEditText = dialogView.findViewById<TextInputEditText>(R.id.emailEditText)
        
        val phone = binding.customerPhoneEditText.text.toString().trim()
        phoneEditText.setText(phone)
        
        // Setup autocomplete for customer name when typing phone number
        var phoneCheckHandler: Handler? = Handler(Looper.getMainLooper())
        var phoneCheckRunnable: Runnable? = null
        
        phoneEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                // Cancel previous check
                phoneCheckRunnable?.let { phoneCheckHandler?.removeCallbacks(it) }
                
                val phoneNumber = s.toString().trim()
                if (phoneNumber.length >= 9) {
                    // Debounce phone check (wait 500ms after user stops typing)
                    phoneCheckRunnable = Runnable {
                        checkCustomerForAutocomplete(phoneNumber) { customer ->
                            if (customer != null && customer.name != null) {
                                nameEditText.setText(customer.name)
                                if (customer.email != null && emailEditText.text.toString().isEmpty()) {
                                    emailEditText.setText(customer.email)
                                }
                            }
                        }
                    }
                    phoneCheckHandler?.postDelayed(phoneCheckRunnable!!, 500)
                }
            }
        })
        
        AlertDialog.Builder(this)
            .setTitle("Create New Customer")
            .setView(dialogView)
            .setPositiveButton("Create") { _, _ ->
                val name = nameEditText.text.toString().trim()
                val phone = phoneEditText.text.toString().trim()
                val email = emailEditText.text.toString().trim()
                
                if (name.isEmpty() || phone.isEmpty()) {
                    Toast.makeText(this, "Name and phone are required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                
                createCustomer(name, phone, email)
            }
            .setNegativeButton("Cancel", null)
            .setOnDismissListener {
                // Clean up handler
                phoneCheckRunnable?.let { phoneCheckHandler?.removeCallbacks(it) }
                phoneCheckHandler = null
            }
            .show()
    }
    
    private fun checkCustomerForAutocomplete(phone: String, callback: (PosCustomer?) -> Unit) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getPosCustomer(phone)
                
                if (response.isSuccessful) {
                    val customer = response.body()?.customer
                    callback(customer)
                } else {
                    callback(null)
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error checking customer for autocomplete: ${e.message}", e)
                callback(null)
            }
        }
    }

    private fun createCustomer(name: String, phone: String, email: String) {
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                // Check if admin is logged in and has a token
                val adminToken = com.dialadrink.driver.utils.SharedPrefs.getAdminToken(this@PosCartActivity)
                if (adminToken == null || adminToken.isEmpty()) {
                    android.util.Log.e("PosCartActivity", "❌ Admin token is missing - cannot create customer")
                    Toast.makeText(this@PosCartActivity, "Authentication error: Please log in again", Toast.LENGTH_LONG).show()
                    binding.loadingProgress.visibility = View.GONE
                    return@launch
                }
                
                android.util.Log.d("PosCartActivity", "✅ Admin token found (length: ${adminToken.length}), proceeding with customer creation")
                
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                } else {
                    // Re-initialize to ensure we have the latest token
                    ApiClient.reinitialize(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().createPosCustomer(
                    CreatePosCustomerRequest(customerName = name, phone = phone, email = if (email.isNotEmpty()) email else null)
                )
                
                android.util.Log.d("PosCartActivity", "Create customer response: code=${response.code()}, isSuccessful=${response.isSuccessful}")
                
                if (response.isSuccessful) {
                    val responseBody = response.body()
                    android.util.Log.d("PosCartActivity", "Response body type: ${responseBody?.javaClass?.simpleName}")
                    android.util.Log.d("PosCartActivity", "Response body: $responseBody")
                    
                    // Backend returns { success: true, customer: {...} }
                    if (responseBody?.success == true && responseBody.customer != null) {
                        val customer = responseBody.customer
                        android.util.Log.d("PosCartActivity", "Customer created: ${customer.name} (${customer.phone})")
                        customerName = customer.name ?: name
                        customerEmail = customer.email ?: email
                        customerExists = true
                        binding.createCustomerButton.visibility = View.GONE
                        Toast.makeText(this@PosCartActivity, "Customer created successfully", Toast.LENGTH_SHORT).show()
                    } else {
                        val errorMessage = responseBody?.error ?: "Failed to create customer"
                        android.util.Log.e("PosCartActivity", "Failed to create customer: $errorMessage")
                        Toast.makeText(this@PosCartActivity, errorMessage, Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    android.util.Log.e("PosCartActivity", "Create customer failed: code=${response.code()}, errorBody=$errorBody")
                    
                    // Handle authentication errors specifically
                    if (response.code() == 401) {
                        android.util.Log.e("PosCartActivity", "❌ Authentication error (401) - token may be invalid or expired")
                        Toast.makeText(this@PosCartActivity, "Authentication error: Please log in again", Toast.LENGTH_LONG).show()
                    } else {
                        val errorMessage = try {
                            if (errorBody != null) {
                                val gson = com.google.gson.Gson()
                                val errorMap = gson.fromJson(errorBody, Map::class.java)
                                errorMap["error"]?.toString() ?: "Failed to create customer (Code: ${response.code()})"
                            } else {
                                "Failed to create customer (Code: ${response.code()})"
                            }
                        } catch (e: Exception) {
                            "Failed to create customer (Code: ${response.code()})"
                        }
                        Toast.makeText(this@PosCartActivity, errorMessage, Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error creating customer: ${e.message}", e)
                Toast.makeText(this@PosCartActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }

    private fun loadTerritories() {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getTerritories()
                
                if (response.isSuccessful) {
                    territories.clear()
                    territories.addAll(response.body() ?: emptyList())
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error loading territories: ${e.message}", e)
            }
        }
    }

    private fun setupOrderTypeSpinner() {
        val orderTypes = listOf("Walk-in", "Delivery")
        val adapter = android.widget.ArrayAdapter(this, android.R.layout.simple_spinner_item, orderTypes)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.orderTypeSpinner.adapter = adapter
        
        // Initialize Staff Purchase checkbox as hidden
        binding.staffPurchaseCheckbox.visibility = View.GONE
        binding.staffPurchaseCheckbox.isChecked = false
        isStaffPurchase = false
        
        // Default to Delivery
        binding.orderTypeSpinner.setSelection(1)
        isWalkIn = false
        
        binding.orderTypeSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                isWalkIn = (position == 0)
                
                if (isWalkIn) {
                    // Walk-in: Set territory to 1Default, hide delivery fee
                    loadTerritoriesForWalkIn()
                    binding.deliveryFeeLayout.visibility = View.GONE
                    binding.deliveryAddressLayout.visibility = View.GONE
                    binding.staffPurchaseCheckbox.visibility = View.VISIBLE
                    // Check if payment method is "Pay on Delivery" (cash) and set phone number
                    updatePhoneNumberForWalkInCash()
                } else {
                    // Delivery: Show delivery address and fee
                    binding.deliveryFeeLayout.visibility = View.VISIBLE
                    binding.deliveryAddressLayout.visibility = View.VISIBLE
                    binding.staffPurchaseCheckbox.visibility = View.GONE
                    binding.staffPurchaseCheckbox.isChecked = false
                    isStaffPurchase = false
                    // Reset customer phone field
                    setupCustomerPhoneField()
                }
                
                saveFormFields()
            }
            
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {
                // Do nothing
            }
        }
    }
    
    private fun loadTerritoriesForWalkIn() {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getTerritories()
                
                if (response.isSuccessful) {
                    territories.clear()
                    territories.addAll(response.body() ?: emptyList())
                    
                    // Find and select "1Default" territory
                    val defaultTerritory = territories.find { 
                        it.name?.equals("1Default", ignoreCase = true) == true || 
                        it.name?.equals("1 Default", ignoreCase = true) == true 
                    }
                    if (defaultTerritory != null) {
                        selectedTerritory = defaultTerritory
                        binding.territoryEditText.setText(defaultTerritory.name ?: "1Default")
                        binding.deliveryFeeEditText.setText("0") // Hide delivery fee for walk-in
                        updateTotals()
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error loading territories for walk-in: ${e.message}", e)
            }
        }
    }

    private fun setupPaymentMethodSpinner() {
        // Use same payment methods for both Walk-in and Delivery (as requested)
        paymentMethodAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            paymentMethods
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        binding.paymentMethodSpinner.adapter = paymentMethodAdapter
        
        // Set default selection to "Pay on Delivery"
        binding.paymentMethodSpinner.setSelection(0)
        selectedPaymentMethod = "pay_on_delivery"
    }
    
    private fun updatePhoneNumberForWalkInCash() {
        // If walk-in and payment method is "Pay on Delivery" (cash), set phone to 0723688108
        // But only if not staff purchase (staff purchase uses driver dropdown)
        if (isWalkIn && selectedPaymentMethod == "pay_on_delivery" && !isStaffPurchase) {
            val defaultPhone = "0723688108"
            // Format phone: if starts with 0, replace with 254
            val formattedPhone = if (defaultPhone.startsWith("0") && defaultPhone.length >= 2) {
                "254" + defaultPhone.substring(1)
            } else {
                defaultPhone
            }
            
            // Set flag to prevent text change listener from interfering
            isSettingCustomerFromAutocomplete = true
            
            // Set the phone number
            binding.customerPhoneEditText.setText(formattedPhone)
            
            android.util.Log.d("PosCartActivity", "Setting phone for Walk-in: $formattedPhone")
            
            // Check if customer exists for this phone number (with a delay to avoid race condition)
            if (formattedPhone.length >= 9) {
                binding.customerPhoneEditText.postDelayed({
                    android.util.Log.d("PosCartActivity", "Checking customer for phone: $formattedPhone")
                    checkCustomer(formattedPhone)
                }, 300) // Delay to ensure text change listener has finished and UI is updated
            }
            
            // Reset flag after a longer delay to allow customer check to complete
            binding.customerPhoneEditText.postDelayed({
                isSettingCustomerFromAutocomplete = false
            }, 1000) // Increased delay to allow API call to complete
            
            saveFormFields() // Save the phone number
        }
    }
    
    private fun loadDrivers() {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getDrivers()
                
                if (response.isSuccessful && response.body()?.success == true) {
                    drivers.clear()
                    drivers.addAll(response.body()?.data ?: emptyList())
                    android.util.Log.d("PosCartActivity", "Loaded ${drivers.size} drivers")
                    // If we have drivers now and staff purchase is checked, show the dialog
                    if (drivers.isNotEmpty() && isStaffPurchase && binding.staffPurchaseCheckbox.isChecked) {
                        showDriverSelectionDialog()
                    }
                } else {
                    val errorCode = response.code()
                    android.util.Log.e("PosCartActivity", "Failed to load drivers: $errorCode")
                    runOnUiThread {
                        when (errorCode) {
                            401 -> Toast.makeText(this@PosCartActivity, "Authentication failed. Please log in again.", Toast.LENGTH_LONG).show()
                            else -> Toast.makeText(this@PosCartActivity, "Failed to load drivers. Error: $errorCode", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error loading drivers: ${e.message}", e)
                runOnUiThread {
                    Toast.makeText(this@PosCartActivity, "Error loading drivers: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    
    private fun setupDriverDropdown() {
        // Show customer phone layout but repurpose it for driver selection
        binding.customerPhoneLayout.visibility = View.VISIBLE
        binding.customerPhoneLayout.hint = "Select Driver"
        binding.customerPhoneLayout.endIconMode = com.google.android.material.textfield.TextInputLayout.END_ICON_DROPDOWN_MENU
        binding.customerPhoneLayout.setEndIconTintList(android.content.res.ColorStateList.valueOf(getColor(R.color.form_field_border_light_green)))
        binding.createCustomerButton.visibility = View.GONE
        
        // Make the EditText show driver selection and open dialog on click
        // Prevent keyboard from showing
        binding.customerPhoneEditText.inputType = android.text.InputType.TYPE_NULL
        binding.customerPhoneEditText.isFocusable = false
        binding.customerPhoneEditText.isFocusableInTouchMode = false
        binding.customerPhoneEditText.isClickable = true
        binding.customerPhoneEditText.setSingleLine(true)
        binding.customerPhoneEditText.ellipsize = android.text.TextUtils.TruncateAt.END
        
        // Clear text and set hint only if no driver is selected
        if (selectedDriver == null) {
            binding.customerPhoneEditText.setText("")
            binding.customerPhoneEditText.hint = ""
            binding.customerPhoneLayout.isHintEnabled = true
            // Reset padding to default
            val padding = resources.getDimensionPixelSize(android.R.dimen.app_icon_size) / 4 // 16dp
            binding.customerPhoneEditText.setPadding(
                padding,
                padding,
                padding,
                padding
            )
        } else {
            // If driver is already selected, show it
            binding.customerPhoneEditText.hint = ""
            val driverText = "${selectedDriver?.name} (${selectedDriver?.phoneNumber})"
            binding.customerPhoneLayout.isHintEnabled = true
            binding.customerPhoneEditText.setText(driverText)
            binding.customerPhoneEditText.setSingleLine(true)
            binding.customerPhoneEditText.ellipsize = android.text.TextUtils.TruncateAt.END
            // Add top padding to prevent overlap with floating hint
            val padding = resources.getDimensionPixelSize(android.R.dimen.app_icon_size) / 4 // 16dp
            val topPadding = padding + resources.getDimensionPixelSize(android.R.dimen.app_icon_size) / 8 // Extra 8dp for hint
            binding.customerPhoneEditText.setPadding(
                padding,
                topPadding,
                padding,
                padding
            )
        }
        
        binding.customerPhoneEditText.setHintTextColor(getColor(R.color.text_secondary_dark))
        
        // Clear any existing listeners and set click listener to show driver selection dialog
        binding.customerPhoneEditText.setOnClickListener(null)
        binding.customerPhoneEditText.setOnClickListener {
            android.util.Log.d("PosCartActivity", "EditText clicked - showing driver dialog")
            showDriverSelectionDialog()
        }
        
        // Also make the entire layout clickable for better UX
        binding.customerPhoneLayout.setOnClickListener(null)
        binding.customerPhoneLayout.setOnClickListener {
            android.util.Log.d("PosCartActivity", "Layout clicked - showing driver dialog")
            showDriverSelectionDialog()
        }
        
        // Make the end icon (dropdown) clickable
        binding.customerPhoneLayout.setEndIconOnClickListener {
            android.util.Log.d("PosCartActivity", "End icon clicked - showing driver dialog")
            showDriverSelectionDialog()
        }
        
        // Remove focus change listener as it might interfere
        binding.customerPhoneEditText.setOnFocusChangeListener(null)
    }
    
    private fun showDriverSelectionDialog() {
        android.util.Log.d("PosCartActivity", "showDriverSelectionDialog called, drivers count: ${drivers.size}")
        
        // Always try to load drivers first if empty
        if (drivers.isEmpty()) {
            android.util.Log.d("PosCartActivity", "No drivers loaded, loading now...")
            Toast.makeText(this, "Loading drivers...", Toast.LENGTH_SHORT).show()
            loadDrivers()
            // Show dialog after a delay to allow drivers to load
            binding.customerPhoneLayout.postDelayed({
                if (drivers.isEmpty()) {
                    android.util.Log.e("PosCartActivity", "Still no drivers after loading")
                    Toast.makeText(this, "Failed to load drivers. Please try again.", Toast.LENGTH_LONG).show()
                } else {
                    android.util.Log.d("PosCartActivity", "Drivers loaded, showing dialog with ${drivers.size} drivers")
                    showDriverSelectionDialog()
                }
            }, 2000)
            return
        }
        
        // Create items list with "Select Driver" as first option
        val items = mutableListOf<String>()
        items.add("Select Driver") // First option to clear selection
        items.addAll(drivers.map { "${it.name} (${it.phoneNumber})" })
        val itemsArray = items.toTypedArray()
        
        android.util.Log.d("PosCartActivity", "Showing dialog with ${itemsArray.size} items (including 'Select Driver')")
        
        val builder = android.app.AlertDialog.Builder(this)
        builder.setTitle("Select Driver")
        builder.setItems(itemsArray) { _, which ->
            android.util.Log.d("PosCartActivity", "Item selected: $which")
            
            if (which == 0) {
                // "Select Driver" option selected - clear selection
                selectedDriver = null
                binding.customerPhoneEditText.setText("")
                binding.customerPhoneEditText.hint = ""
                binding.customerPhoneLayout.isHintEnabled = true
                // Reset padding to default
                val padding = resources.getDimensionPixelSize(android.R.dimen.app_icon_size) / 4 // 16dp
                binding.customerPhoneEditText.setPadding(
                    padding,
                    padding,
                    padding,
                    padding
                )
            } else {
                // Driver selected (index - 1 because first item is "Select Driver")
                val driverIndex = which - 1
                if (driverIndex >= 0 && driverIndex < drivers.size) {
                    selectedDriver = drivers[driverIndex]
                    val driverText = "${selectedDriver?.name} (${selectedDriver?.phoneNumber})"
                    
                    // Clear EditText hint completely to prevent overlap
                    binding.customerPhoneEditText.hint = ""
                    // Ensure TextInputLayout hint is enabled
                    binding.customerPhoneLayout.isHintEnabled = true
                    binding.customerPhoneLayout.isHintAnimationEnabled = true
                    
                    // Set text
                    binding.customerPhoneEditText.setText(driverText)
                    binding.customerPhoneEditText.setSingleLine(true)
                    binding.customerPhoneEditText.ellipsize = android.text.TextUtils.TruncateAt.END
                    
                    // Add top padding to prevent overlap with floating hint
                    val padding = resources.getDimensionPixelSize(android.R.dimen.app_icon_size) / 4 // 16dp
                    val topPadding = padding + resources.getDimensionPixelSize(android.R.dimen.app_icon_size) / 8 // Extra 8dp for hint
                    binding.customerPhoneEditText.setPadding(
                        padding,
                        topPadding,
                        padding,
                        padding
                    )
                }
            }
            
            // Force TextInputLayout to recognize text and float hint
            binding.customerPhoneLayout.post {
                binding.customerPhoneLayout.requestLayout()
                binding.customerPhoneEditText.requestLayout()
            }
            
            saveFormFields()
        }
        
        val dialog = builder.create()
        dialog.show()
        android.util.Log.d("PosCartActivity", "Dialog shown")
    }
    
    private fun setupCustomerPhoneField() {
        // Show customer phone field and hide driver selection
        binding.customerPhoneLayout.visibility = View.VISIBLE
        // Remove dropdown icon when in customer phone mode
        binding.customerPhoneLayout.endIconMode = com.google.android.material.textfield.TextInputLayout.END_ICON_NONE
        binding.customerPhoneEditText.isFocusable = true
        binding.customerPhoneEditText.isClickable = true
        binding.customerPhoneEditText.setOnClickListener(null)
        selectedDriver = null
        binding.customerPhoneEditText.setText("")
    }
    
    private fun setupStaffPurchasePaymentMethods() {
        // Limit payment methods to "Cash" or "Cash at Hand"
        val staffPaymentMethods = listOf("Cash", "Cash at Hand")
        val staffAdapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            staffPaymentMethods
        ).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        binding.paymentMethodSpinner.adapter = staffAdapter
        binding.paymentMethodSpinner.setSelection(0)
        selectedPaymentMethod = "cash"
    }
    
    private fun increaseDriverCashAtHand(driverId: Int, amount: Double) {
        lifecycleScope.launch {
            try {
                // Create a transaction that increases driver's cash at hand
                // The backend will handle this when processing the order with "Cash at Hand" note
                // For now, we just log it - the backend should detect the order note and process it
                android.util.Log.d("PosCartActivity", "💰 Staff Purchase with Cash at Hand: Driver ID=$driverId, Amount=KES $amount")
                android.util.Log.d("PosCartActivity", "   Backend should increase driver's cash at hand when processing this order")
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error logging cash at hand increase: ${e.message}", e)
            }
        }
    }

    private fun showTerritoryDialog() {
        if (territories.isEmpty()) {
            Toast.makeText(this, "Loading territories...", Toast.LENGTH_SHORT).show()
            return
        }
        
        // Create custom dialog with search
        val dialogView = layoutInflater.inflate(R.layout.dialog_territory_search, null)
        val searchEditText = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.searchTerritoryEditText)
        val recyclerView = dialogView.findViewById<RecyclerView>(R.id.territoryRecyclerView)
        
        // Filtered territories list
        val filteredTerritories = mutableListOf<Territory>()
        filteredTerritories.addAll(territories)
        
        // Create dialog first so we can reference it in the adapter
        val dialog = AlertDialog.Builder(this)
            .setTitle("Select Territory")
            .setView(dialogView)
            .setNegativeButton("Cancel", null)
            .create()
        
        // Setup RecyclerView
        val adapter = TerritoryAdapter(filteredTerritories) { territory ->
            selectedTerritory = territory
            binding.territoryEditText.setText(territory.name ?: "")
            binding.deliveryFeeEditText.setText((territory.deliveryFromCBD ?: 0.0).toString())
            updateTotals()
            saveFormFields() // Save territory selection
            dialog.dismiss()
        }
        
        // Restore territory selection if available
        val savedTerritoryId = sharedPrefs.getInt(PREFS_TERRITORY_ID, -1)
        if (savedTerritoryId != -1) {
            val savedTerritory = territories.find { it.id == savedTerritoryId }
            if (savedTerritory != null) {
                selectedTerritory = savedTerritory
                binding.territoryEditText.setText(savedTerritory.name ?: "")
                binding.deliveryFeeEditText.setText((savedTerritory.deliveryFromCBD ?: 0.0).toString())
                updateTotals()
            }
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
        
        // Setup search
        searchEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s.toString().trim().lowercase()
                filteredTerritories.clear()
                
                if (query.isEmpty()) {
                    filteredTerritories.addAll(territories)
                } else {
                    filteredTerritories.addAll(territories.filter {
                        it.name?.lowercase()?.contains(query) == true
                    })
                }
                
                adapter.notifyDataSetChanged()
            }
        })
        
        dialog.show()
    }
    
    private inner class TerritoryAdapter(
        private val items: List<Territory>,
        private val onItemClick: (Territory) -> Unit
    ) : RecyclerView.Adapter<TerritoryAdapter.ViewHolder>() {
        
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val territoryNameText: TextView = view.findViewById(R.id.territoryNameText)
            val territoryPriceText: TextView = view.findViewById(R.id.territoryPriceText)
        }
        
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_territory, parent, false)
            return ViewHolder(view)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val territory = items[position]
            holder.territoryNameText.text = territory.name ?: ""
            val price = territory.deliveryFromCBD ?: 0.0
            holder.territoryPriceText.text = "KES ${String.format("%.0f", price)}"
            
            holder.itemView.setOnClickListener {
                onItemClick(territory)
            }
        }
        
        override fun getItemCount() = items.size
    }

    private fun updateTotals() {
        val orderTotal = cart.sumOf { it.price * it.quantity }
        val deliveryFee = binding.deliveryFeeEditText.text.toString().toDoubleOrNull() ?: 0.0
        val total = orderTotal + deliveryFee
        
        binding.orderTotalText.text = currencyFormatter.format(orderTotal)
        binding.deliveryFeeText.text = currencyFormatter.format(deliveryFee)
        binding.totalText.text = currencyFormatter.format(total)
        
        // Calculate and display profit/loss
        calculateAndDisplayProfitLoss(orderTotal, deliveryFee)
    }
    
    private fun calculateAndDisplayProfitLoss(orderTotal: Double, deliveryFee: Double) {
        try {
            var totalPurchaseCost = 0.0
            var hasPurchasePrice = false
            
            cart.forEach { item ->
                val purchasePrice = item.purchasePrice
                if (purchasePrice != null && purchasePrice >= 0) {
                    totalPurchaseCost += purchasePrice * item.quantity
                    hasPurchasePrice = true
                }
            }
            
            if (hasPurchasePrice) {
                val profit = orderTotal - totalPurchaseCost - deliveryFee
                binding.profitLossContainer.visibility = View.VISIBLE
                val profitAmount = Math.abs(profit)
                
                if (profit >= 0) {
                    binding.profitLossChip.text = "PROFIT +KES ${String.format("%.2f", profitAmount)}"
                    binding.profitLossChip.chipBackgroundColor = ColorStateList.valueOf(Color.parseColor("#4caf50")) // Green
                } else {
                    binding.profitLossChip.text = "LOSS -KES ${String.format("%.2f", profitAmount)}"
                    binding.profitLossChip.chipBackgroundColor = ColorStateList.valueOf(Color.parseColor("#f44336")) // Red
                }
            } else {
                binding.profitLossContainer.visibility = View.GONE
            }
        } catch (e: Exception) {
            android.util.Log.e("PosCartActivity", "Error calculating profit/loss: ${e.message}", e)
            binding.profitLossContainer.visibility = View.GONE
        }
    }

    private fun submitOrder() {
        // Get phone - from driver if staff purchase, otherwise from customer phone field
        val phone = if (isStaffPurchase) {
            if (selectedDriver == null) {
                Toast.makeText(this, "Please select a driver", Toast.LENGTH_SHORT).show()
                return
            }
            selectedDriver!!.phoneNumber
        } else {
            binding.customerPhoneEditText.text.toString().trim()
        }
        
        val deliveryAddress = binding.deliveryAddressEditText.text.toString().trim()
        
        if (phone.isEmpty()) {
            Toast.makeText(this, if (isStaffPurchase) "Please select a driver" else "Please enter customer phone number", Toast.LENGTH_SHORT).show()
            return
        }
        
        // Only require delivery address for delivery orders, not walk-in
        if (!isWalkIn && deliveryAddress.isEmpty()) {
            Toast.makeText(this, "Please enter delivery address", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (!customerExists && customerName.isEmpty()) {
            Toast.makeText(this, "Please create customer first", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (cart.isEmpty()) {
            Toast.makeText(this, "Cart is empty", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (customerName.isEmpty()) {
            customerName = "Customer" // Default name if not set
        }
        
                val deliveryFee = binding.deliveryFeeEditText.text.toString().toDoubleOrNull() ?: 0.0
                val territoryId = selectedTerritory?.id
                
                // Determine payment method and status based on selection
                val (paymentMethod, paymentType, paymentStatus) = when {
                    isStaffPurchase -> {
                        // Staff Purchase: Only "Cash" or "Cash at Hand"
                        when (selectedPaymentMethod) {
                            "cash_at_hand" -> {
                                // Cash at Hand: Will increase driver's cash at hand
                                Triple("cash", "pay_now", "paid")
                            }
                            else -> {
                                // Cash: Regular cash payment
                                Triple("cash", "pay_now", "paid")
                            }
                        }
                    }
                    else -> {
                        // Regular payment methods
                        when (selectedPaymentMethod) {
                            "pay_on_delivery" -> {
                                if (isWalkIn) {
                                    // Walk-in: Cash at counter, paid immediately
                                    Triple("cash", "pay_now", "paid")
                                } else {
                                    // Delivery: Rider collects cash, unpaid until collected
                                    Triple(null, "pay_on_delivery", "unpaid")
                                }
                            }
                            "swipe_on_delivery" -> {
                                if (isWalkIn) {
                                    // Walk-in: Card swipe at counter, paid immediately
                                    Triple("card", "pay_now", "paid")
                                } else {
                                    // Delivery: Card swipe on delivery, unpaid until swiped
                                    Triple("card", "pay_on_delivery", "unpaid")
                                }
                            }
                            "already_paid" -> {
                                // Already paid - use cash for walk-in, card for delivery
                                if (isWalkIn) {
                                    Triple("cash", "pay_now", "paid")
                                } else {
                                    Triple("card", "pay_now", "paid")
                                }
                            }
                            else -> {
                                // Default: same as pay_on_delivery
                                if (isWalkIn) {
                                    Triple("cash", "pay_now", "paid")
                                } else {
                                    Triple(null, "pay_on_delivery", "unpaid")
                                }
                            }
                        }
                    }
                }
                
                // For walk-in orders, set delivery address to "In-Store Purchase" and territory to 1Default
                val finalDeliveryAddress = if (isWalkIn) {
                    "In-Store Purchase"
                } else {
                    deliveryAddress
                }
                
                // For walk-in, find 1Default territory
                var finalTerritoryId = territoryId
                if (isWalkIn) {
                    val defaultTerritory = territories.find { 
                        it.name?.equals("1Default", ignoreCase = true) == true || 
                        it.name?.equals("1 Default", ignoreCase = true) == true 
                    }
                    finalTerritoryId = defaultTerritory?.id
                }
                
                binding.loadingProgress.visibility = View.VISIBLE
                
                lifecycleScope.launch {
                    try {
                        if (!ApiClient.isInitialized()) {
                            ApiClient.init(this@PosCartActivity)
                        }
                        
                        val orderItems = cart.map {
                            PosOrderItem(
                                drinkId = it.drinkId,
                                quantity = it.quantity,
                                selectedPrice = it.price
                            )
                        }
                        
                        // Create POS order (like "New Order" on admin web)
                        // Admin can prompt customer for payment OR rider can receive payment
                        val request = CreateOrderRequest(
                            customerName = customerName,
                            customerPhone = phone,
                            customerEmail = if (customerEmail.isNotEmpty()) customerEmail else null,
                            deliveryAddress = finalDeliveryAddress,
                            items = orderItems,
                            paymentType = paymentType,
                            paymentMethod = paymentMethod, // Will be 'cash', 'card', or null
                            paymentStatus = paymentStatus,
                            status = if (isWalkIn) "completed" else "pending", // Walk-in orders are completed immediately, delivery goes to assign rider
                            adminOrder = true,
                            deliveryFee = if (isWalkIn) 0.0 else deliveryFee, // No delivery fee for walk-in
                            territoryId = finalTerritoryId,
                            notes = when {
                                isStaffPurchase && selectedPaymentMethod == "cash_at_hand" -> {
                                    "POS Order - Staff Purchase (Cash at Hand) - Driver ID: ${selectedDriver?.id}"
                                }
                                isStaffPurchase -> {
                                    "POS Order - Staff Purchase - Driver ID: ${selectedDriver?.id}"
                                }
                                isWalkIn -> "POS Order - Walk-in"
                                else -> "POS Order"
                            }
                        )
                        
                        android.util.Log.d("PosCartActivity", "Order request details: paymentMethod=$paymentMethod, paymentType=$paymentType, paymentStatus=$paymentStatus, isWalkIn=$isWalkIn, deliveryAddress=$finalDeliveryAddress")
                
                android.util.Log.d("PosCartActivity", "Submitting order: ${request}")
                val response = ApiClient.getApiService().createOrder(request)
                
                android.util.Log.d("PosCartActivity", "Order response: code=${response.code()}, isSuccessful=${response.isSuccessful}")
                
                // The /api/orders endpoint returns the order directly (status 201)
                // Check for successful HTTP status code (201 Created or 200 OK)
                if (response.isSuccessful && (response.code() == 201 || response.code() == 200)) {
                    val responseBody = response.body()
                    android.util.Log.d("PosCartActivity", "Response body type: ${responseBody?.javaClass?.simpleName}")
                    android.util.Log.d("PosCartActivity", "Response body: $responseBody")
                    
                    // The backend returns the order directly, not wrapped in ApiResponse
                    val order = when {
                        responseBody == null -> {
                            android.util.Log.e("PosCartActivity", "Response body is null")
                            null
                        }
                        responseBody is ApiResponse<*> -> {
                            android.util.Log.d("PosCartActivity", "Response wrapped in ApiResponse, extracting data")
                            responseBody.data as? Order
                        }
                        responseBody is Map<*, *> -> {
                            android.util.Log.d("PosCartActivity", "Response is Map, attempting to parse as Order")
                            // Try to parse Map as Order using Gson
                            try {
                                val gson = com.google.gson.Gson()
                                val json = gson.toJson(responseBody)
                                gson.fromJson(json, Order::class.java)
                            } catch (e: Exception) {
                                android.util.Log.e("PosCartActivity", "Failed to parse Map as Order: ${e.message}", e)
                                null
                            }
                        }
                        else -> {
                            android.util.Log.d("PosCartActivity", "Response is direct Order object")
                            responseBody as? Order
                        }
                    }
                    
                    if (order != null && order.id > 0) {
                        android.util.Log.d("PosCartActivity", "Order created successfully: ID=${order.id}")
                        
                        // If staff purchase with Cash at Hand payment, increase driver's cash at hand
                        if (isStaffPurchase && selectedPaymentMethod == "cash_at_hand" && selectedDriver != null) {
                            increaseDriverCashAtHand(selectedDriver!!.id, order.totalAmount)
                        }
                        
                        Toast.makeText(this@PosCartActivity, "Order submitted successfully", Toast.LENGTH_SHORT).show()
                        clearCartAndFormFields()
                        finish()
                    } else {
                        android.util.Log.e("PosCartActivity", "Order response body is null or invalid format")
                        android.util.Log.e("PosCartActivity", "Order object: $order")
                        android.util.Log.e("PosCartActivity", "Order ID: ${order?.id}")
                        // Even if we can't parse the order, if the response was successful (201), the order was likely created
                        // Show success message but log the issue
                        Toast.makeText(this@PosCartActivity, "Order submitted successfully", Toast.LENGTH_SHORT).show()
                        clearCartAndFormFields()
                        finish()
                    }
                } else {
                    // Read error body from errorBody() not body()
                    val errorBodyString = response.errorBody()?.string()
                    android.util.Log.e("PosCartActivity", "Order submission failed: code=${response.code()}, errorBody=$errorBodyString")
                    
                    val errorMessage = try {
                        if (errorBodyString != null) {
                            val gson = com.google.gson.Gson()
                            val errorMap = gson.fromJson(errorBodyString, Map::class.java)
                            errorMap["error"]?.toString() ?: errorMap["message"]?.toString() ?: "Failed to submit order (Code: ${response.code()})"
                        } else {
                            "Failed to submit order (Code: ${response.code()})"
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("PosCartActivity", "Error parsing error body: ${e.message}", e)
                        "Failed to submit order (Code: ${response.code()})"
                    }
                    
                    android.util.Log.e("PosCartActivity", "Error message: $errorMessage")
                    android.util.Log.e("PosCartActivity", "Request sent: customerName=$customerName, phone=$phone, deliveryAddress=$finalDeliveryAddress, isWalkIn=$isWalkIn, paymentMethod=$paymentMethod, paymentType=$paymentType")
                    
                    Toast.makeText(this@PosCartActivity, errorMessage, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error submitting order: ${e.message}", e)
                Toast.makeText(this@PosCartActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                binding.loadingProgress.visibility = View.GONE
            }
        }
    }

    enum class CartAction {
        INCREASE, DECREASE, DELETE
    }

    inner class CartAdapter(
        private val items: List<PosCartItem>,
        private val onAction: (PosCartItem, CartAction) -> Unit
    ) : RecyclerView.Adapter<CartAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val productNameText: TextView = view.findViewById(R.id.productNameText)
            val capacityText: TextView = view.findViewById(R.id.capacityText)
            val priceText: TextView = view.findViewById(R.id.priceText)
            val quantityText: TextView = view.findViewById(R.id.quantityText)
            val increaseButton = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.increaseButton)
            val decreaseButton = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.decreaseButton)
            val deleteButton = view.findViewById<com.google.android.material.button.MaterialButton>(R.id.deleteButton)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_pos_cart, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.productNameText.text = item.name
            holder.capacityText.text = "Capacity: ${item.capacity ?: "N/A"}"
            holder.priceText.text = currencyFormatter.format(item.price * item.quantity)
            holder.quantityText.text = item.quantity.toString()
            
            holder.increaseButton.setOnClickListener { onAction(item, CartAction.INCREASE) }
            holder.decreaseButton.setOnClickListener { onAction(item, CartAction.DECREASE) }
            holder.deleteButton.setOnClickListener { onAction(item, CartAction.DELETE) }
        }

        override fun getItemCount() = items.size
    }
}
