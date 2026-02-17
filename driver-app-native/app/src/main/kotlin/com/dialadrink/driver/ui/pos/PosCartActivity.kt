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
    private val customerSuggestions = mutableListOf<PosCustomer>()
    private var customerPhoneAdapter: ArrayAdapter<String>? = null
    private var selectedAddressText: String = "" // Store selected address to preserve it

    companion object {
        const val CART_EXTRA = "cart"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPosCartBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)

        // Get cart from intent
        val cartItems = intent.getParcelableArrayListExtra<PosCartItem>(CART_EXTRA)
        if (cartItems != null) {
            cart.clear()
            cart.addAll(cartItems)
        }
        
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
    
    override fun onDestroy() {
        super.onDestroy()
        // Clean up handlers to prevent memory leaks
        phoneCheckRunnable?.let { phoneCheckHandler.removeCallbacks(it) }
        addressCheckRunnable?.let { addressCheckHandler.removeCallbacks(it) }
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

        binding.createCustomerButton.setOnClickListener {
            showCreateCustomerDialog()
        }

        binding.territoryEditText.setOnClickListener {
            showTerritoryDialog()
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
        // Create adapter for customer phone autocomplete with dark theme
        customerPhoneAdapter = ArrayAdapter(this, R.layout.item_dropdown_dark, mutableListOf())
        binding.customerPhoneEditText.setAdapter(customerPhoneAdapter)
        
        // Set dropdown background to dark color
        val drawable = android.graphics.drawable.ColorDrawable(getColor(R.color.paper_dark))
        binding.customerPhoneEditText.setDropDownBackgroundDrawable(drawable)
        
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
                    binding.createCustomerButton.visibility = View.GONE
                    customerPhoneAdapter?.clear()
                    customerPhoneAdapter?.notifyDataSetChanged()
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
        // Create adapter for autocomplete suggestions with dark theme
        addressAdapter = ArrayAdapter(this, R.layout.item_dropdown_dark, mutableListOf())
        binding.deliveryAddressEditText.setAdapter(addressAdapter)
        
        // Set dropdown background to dark color
        val drawable = android.graphics.drawable.ColorDrawable(getColor(R.color.paper_dark))
        binding.deliveryAddressEditText.setDropDownBackgroundDrawable(drawable)
        
        // Handle text changes to fetch autocomplete predictions
        binding.deliveryAddressEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s.toString().trim()
                if (query.length >= 1) {
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
                val addressText = suggestion.description
                // Store the selected address text before fetching details
                selectedAddressText = addressText
                binding.deliveryAddressEditText.setText(addressText)
                binding.deliveryAddressEditText.clearFocus()
                
                // Fetch place details if placeId exists (for coordinates, but preserve selected address)
                if (suggestion.placeId != null) {
                    fetchPlaceDetails(suggestion.placeId!!, addressText)
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
        addressCheckHandler.postDelayed(addressCheckRunnable!!, 300)
    }
    
    private fun fetchPlaceDetails(placeId: String, selectedAddress: String? = null) {
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getPlaceDetails(placeId)
                
                if (response.isSuccessful && response.body() != null) {
                    val placeDetails = response.body()!!
                    
                    // Determine which address to use:
                    // 1. If user selected a specific address (like "Denali Apartments"), prefer it
                    // 2. Otherwise, use formatted_address from Google
                    // 3. Fallback to name if formatted_address is not available
                    val addressToUse = when {
                        // If we have a selected address and it contains the place name, use it
                        selectedAddress != null && selectedAddress.isNotEmpty() -> {
                            val placeName = placeDetails.name ?: ""
                            val formattedAddress = placeDetails.formatted_address ?: ""
                            
                            // If selected address contains the place name, it's likely more specific
                            if (placeName.isNotEmpty() && selectedAddress.contains(placeName, ignoreCase = true)) {
                                selectedAddress
                            } else if (formattedAddress.isNotEmpty() && formattedAddress.contains(placeName, ignoreCase = true)) {
                                // formatted_address contains the name, use it
                                formattedAddress
                            } else {
                                // Use selected address if it seems more specific than formatted_address
                                // (e.g., "Denali Apartments" vs "Riruta, Nairobi")
                                if (selectedAddress.split(',').size <= formattedAddress.split(',').size) {
                                    selectedAddress
                                } else {
                                    formattedAddress.ifEmpty { placeName }
                                }
                            }
                        }
                        placeDetails.formatted_address != null && placeDetails.formatted_address!!.isNotEmpty() -> {
                            placeDetails.formatted_address!!
                        }
                        placeDetails.name != null && placeDetails.name!!.isNotEmpty() -> {
                            placeDetails.name!!
                        }
                        else -> ""
                    }
                    
                    if (addressToUse.isNotEmpty()) {
                        binding.deliveryAddressEditText.setText(addressToUse)
                        binding.deliveryAddressEditText.clearFocus()
                        selectedAddressText = addressToUse
                    }
                } else {
                    android.util.Log.e("PosCartActivity", "Failed to fetch place details: ${response.code()}")
                    // Don't show error toast - user already has an address selected
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error fetching place details: ${e.message}", e)
                // Don't show error toast - user already has an address selected
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
    }

    private fun decreaseQuantity(item: PosCartItem) {
        if (item.quantity > 1) {
            item.quantity--
            adapter.notifyDataSetChanged()
            updateTotals()
        }
    }

    private fun deleteItem(item: PosCartItem) {
        cart.remove(item)
        adapter.notifyDataSetChanged()
        updateTotals()
        if (cart.isEmpty()) {
            Toast.makeText(this, "Cart is empty", Toast.LENGTH_SHORT).show()
        }
    }

    private fun checkCustomer(phone: String) {
        binding.loadingProgress.visibility = View.VISIBLE
        
        lifecycleScope.launch {
            try {
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().getPosCustomer(phone)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val customer = response.body()!!.data
                    // Only update customerExists if we haven't already confirmed it from autocomplete
                    if (!customerExists) {
                        customerExists = customer?.exists == true
                    }
                    
                    if (customerExists && customer != null) {
                        // Update customer info if not already set from autocomplete
                        if (customerName.isEmpty()) {
                            customerName = customer.name ?: ""
                            customerEmail = customer.email ?: ""
                        }
                        binding.createCustomerButton.visibility = View.GONE
                    } else {
                        binding.createCustomerButton.visibility = View.VISIBLE
                    }
                } else {
                    // Only update state if customer wasn't already confirmed to exist
                    if (!customerExists) {
                        customerExists = false
                        binding.createCustomerButton.visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PosCartActivity", "Error checking customer: ${e.message}", e)
                customerExists = false
                binding.createCustomerButton.visibility = View.VISIBLE
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
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val customer = response.body()!!.data
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
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosCartActivity)
                }
                
                val response = ApiClient.getApiService().createPosCustomer(
                    CreatePosCustomerRequest(name = name, phone = phone, email = if (email.isNotEmpty()) email else null)
                )
                
                if (response.isSuccessful && response.body()?.success == true) {
                    customerName = name
                    customerEmail = email
                    customerExists = true
                    binding.createCustomerButton.visibility = View.GONE
                    Toast.makeText(this@PosCartActivity, "Customer created successfully", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@PosCartActivity, "Failed to create customer", Toast.LENGTH_SHORT).show()
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
        
        binding.paymentMethodSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                selectedPaymentMethod = when (position) {
                    0 -> "pay_on_delivery"
                    1 -> "card"
                    2 -> "cash"
                    else -> "pay_on_delivery"
                }
                
                // If walk-in, update phone number based on payment method
                if (isWalkIn) {
                    updatePhoneNumberForWalkInCash()
                }
            }
            
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {
                // Do nothing
            }
        }
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
        }
    }
    
    private fun setupCustomerPhoneField() {
        // Reset customer phone field for delivery orders
        binding.customerPhoneLayout.hint = "Customer Phone Number"
        binding.customerPhoneLayout.endIconMode = com.google.android.material.textfield.TextInputLayout.END_ICON_NONE
        binding.customerPhoneEditText.inputType = android.text.InputType.TYPE_CLASS_PHONE
        binding.customerPhoneEditText.isFocusable = true
        binding.customerPhoneEditText.isFocusableInTouchMode = true
        binding.customerPhoneEditText.isClickable = true
    }

    private fun showPaymentMethodDialog() {
        // Payment method is now handled by spinner, but keep this for backward compatibility if needed
        val options = arrayOf("Pay on Delivery", "Swipe on Delivery", "Already Paid")
        val currentIndex = when (selectedPaymentMethod) {
            "pay_on_delivery" -> 0
            "card" -> 1
            "cash" -> 2
            else -> 0 // Default to "Pay on Delivery"
        }
        
        AlertDialog.Builder(this)
            .setTitle("Select Payment Method")
            .setSingleChoiceItems(options, currentIndex) { dialog, which ->
                selectedPaymentMethod = when (which) {
                    0 -> "pay_on_delivery"
                    1 -> "card"
                    2 -> "cash"
                    else -> "pay_on_delivery"
                }
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
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
            dialog.dismiss()
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
            holder.territoryPriceText.text = "KES ${territory.deliveryFromCBD ?: 0.0}"
            
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
        val phone = binding.customerPhoneEditText.text.toString().trim()
        val deliveryAddress = if (isWalkIn) "In-Store Purchase" else binding.deliveryAddressEditText.text.toString().trim()
        
        // For walk-in orders, phone can be empty or "POS"
        if (!isWalkIn && phone.isEmpty()) {
            Toast.makeText(this, "Please enter customer phone number", Toast.LENGTH_SHORT).show()
            return
        }
        
        // For delivery orders, address is required
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
                // Default to "pay_on_delivery" if not selected
                val paymentMethod = selectedPaymentMethod ?: "pay_on_delivery"
                val paymentType = when (paymentMethod) {
                    "cash" -> "pay_now"
                    "pay_on_delivery" -> "pay_on_delivery"
                    else -> "pay_on_delivery"
                }
                val paymentStatus = when (paymentMethod) {
                    "cash" -> "paid" // Cash collected immediately
                    "pay_on_delivery" -> "unpaid" // Rider will collect payment
                    else -> "unpaid"
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
                        // For walk-in orders, use "POS" as phone placeholder if empty
                        val customerPhoneForOrder = if (isWalkIn && phone.isEmpty()) "POS" else phone
                        
                        val request = CreateOrderRequest(
                            customerName = customerName,
                            customerPhone = customerPhoneForOrder,
                            customerEmail = if (customerEmail.isNotEmpty()) customerEmail else null,
                            deliveryAddress = deliveryAddress,
                            items = orderItems,
                            paymentType = paymentType,
                            paymentMethod = paymentMethod,
                            paymentStatus = paymentStatus,
                            status = "pending", // Pending so it can be assigned to rider
                            adminOrder = true,
                            deliveryFee = deliveryFee,
                            territoryId = territoryId,
                            notes = if (isWalkIn) "POS Order - Walk-in" else "POS Order"
                        )
                
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
                        Toast.makeText(this@PosCartActivity, "Order submitted successfully", Toast.LENGTH_SHORT).show()
                        cart.clear()
                        finish()
                    } else {
                        android.util.Log.e("PosCartActivity", "Order response body is null or invalid format")
                        android.util.Log.e("PosCartActivity", "Order object: $order")
                        android.util.Log.e("PosCartActivity", "Order ID: ${order?.id}")
                        // Even if we can't parse the order, if the response was successful (201), the order was likely created
                        // Show success message but log the issue
                        Toast.makeText(this@PosCartActivity, "Order submitted successfully", Toast.LENGTH_SHORT).show()
                        cart.clear()
                        finish()
                    }
                } else {
                    val errorBody = response.body()
                    val errorMessage = when {
                        errorBody is ApiResponse<*> && errorBody.error != null -> errorBody.error
                        errorBody is Map<*, *> && errorBody.containsKey("error") -> errorBody["error"].toString()
                        errorBody is Map<*, *> && errorBody.containsKey("message") -> errorBody["message"].toString()
                        else -> "Failed to submit order (Code: ${response.code()})"
                    }
                    
                    android.util.Log.e("PosCartActivity", "Order submission failed: $errorMessage")
                    android.util.Log.e("PosCartActivity", "Response body: $errorBody")
                    android.util.Log.e("PosCartActivity", "Response code: ${response.code()}")
                    
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
