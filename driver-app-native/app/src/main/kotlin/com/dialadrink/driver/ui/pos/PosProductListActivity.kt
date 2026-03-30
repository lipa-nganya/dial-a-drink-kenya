package com.dialadrink.driver.ui.pos

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.CapacityPricing
import com.dialadrink.driver.data.model.PosProduct
import com.dialadrink.driver.data.model.PosCartItem
import com.dialadrink.driver.databinding.ActivityPosProductListBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class PosProductListActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPosProductListBinding
    private val products = mutableListOf<PosProduct>()
    private val filteredProducts = mutableListOf<PosProduct>()
    private val cart = mutableListOf<PosCartItem>()
    private lateinit var adapter: ProductAdapter
    private val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "KE")).apply {
        maximumFractionDigits = 0
        minimumFractionDigits = 0
    }
    private var currentOffset = 0
    private val pageSize = 10
    private var hasMoreProducts = true
    private var isLoading = false

    private fun capacityUnitMultiplier(capacityLabel: String?): Int {
        val raw = (capacityLabel ?: "").trim().lowercase()
        if (raw.isBlank()) return 1
        val compact = raw.replace("\\s+".toRegex(), "")
        val match = Regex("^(\\d+)(pack|pk).*").find(compact)
        val n = match?.groupValues?.getOrNull(1)?.toIntOrNull()
        return if (n != null && n > 0) n else 1
    }

    private fun isCanPackSharedStockProduct(product: PosProduct): Boolean {
        val values = product.capacityPricing
            ?.mapNotNull { it.effectiveCapacity }
            ?.filter { it.isNotBlank() }
            ?: emptyList()
        val normalized = values.map { it.trim().lowercase().replace("\\s+".toRegex(), "") }
        val hasPack = normalized.any { Regex("^(\\d+)(pack|pk).*").matches(it) || it.contains("pack") || it.contains("pk") }
        val hasCan = normalized.any { it.contains("can") || it == "single" }
        return hasPack && hasCan
    }

    private fun capacityStockForDisplay(product: PosProduct, capacity: String?): Int {
        val totalStock = (product.stock ?: 0).coerceAtLeast(0)
        if (!isCanPackSharedStockProduct(product)) return totalStock
        val multiplier = capacityUnitMultiplier(capacity)
        return if (multiplier > 1) totalStock / multiplier else totalStock
    }

    companion object {
        const val CART_EXTRA = "cart"
        const val RESULT_CART_UPDATED = 100
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPosProductListBinding.inflate(layoutInflater)
        setContentView(binding.root)
        applySearchFieldColors()

        // Initialize API client immediately and synchronously if possible
        if (!ApiClient.isInitialized()) {
            ApiClient.init(this)
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)

        // Restore cart from intent if coming from cart screen, otherwise load from SharedPrefs
        val cartItems = intent.getParcelableArrayListExtra<PosCartItem>(CART_EXTRA)
        if (cartItems != null && cartItems.isNotEmpty()) {
            cart.clear()
            cart.addAll(cartItems)
            // Save to SharedPrefs when cart is passed via Intent
            SharedPrefs.savePosCart(this, cart)
        } else {
            // Load cart from SharedPrefs if no cart passed via Intent
            val savedCart = SharedPrefs.getPosCart(this)
            if (savedCart.isNotEmpty()) {
                cart.clear()
                cart.addAll(savedCart)
            }
        }

        setupRecyclerView()
        setupSearch()
        setupViewCartButton()
        
        // Start loading products immediately - don't wait for anything
        loadProducts(initialLoad = true)
    }

    private fun applySearchFieldColors() {
        val textColor = ContextCompat.getColor(this, R.color.text_primary_dark)
        val hintColor = ContextCompat.getColor(this, R.color.text_secondary_dark)
        binding.searchEditText.setTextColor(textColor)
        binding.searchEditText.setHintTextColor(hintColor)
    }

    override fun onPause() {
        super.onPause()
        // Save cart when navigating away
        SharedPrefs.savePosCart(this, cart)
    }
    
    override fun onSupportNavigateUp(): Boolean {
        // Save cart before navigating back
        SharedPrefs.savePosCart(this, cart)
        finish()
        return true
    }

    private fun setupRecyclerView() {
        adapter = ProductAdapter(filteredProducts) { product ->
            addToCart(product)
        }
        val layoutManager = LinearLayoutManager(this)
        binding.productsRecyclerView.layoutManager = layoutManager
        binding.productsRecyclerView.adapter = adapter
        
        // Add scroll listener for lazy loading (infinite scrolling)
        binding.productsRecyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                
                val visibleItemCount = layoutManager.childCount
                val totalItemCount = layoutManager.itemCount
                val firstVisibleItemPosition = layoutManager.findFirstVisibleItemPosition()
                
                // Load more when user scrolls near the bottom (within 5 items of the end)
                // Only trigger if scrolling down (dy > 0) to avoid loading when scrolling up
                if (dy > 0 && !isLoading && hasMoreProducts) {
                    if ((visibleItemCount + firstVisibleItemPosition) >= totalItemCount - 5) {
                        android.util.Log.d("PosProductListActivity", "Lazy loading: Loading more products")
                        loadProducts(initialLoad = false)
                    }
                }
            }
        })
    }

    private fun setupSearch() {
        var searchHandler = Handler(Looper.getMainLooper())
        var searchRunnable: Runnable? = null
        
        binding.searchEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s.toString().trim()
                
                // Cancel previous search
                searchRunnable?.let { searchHandler.removeCallbacks(it) }
                
                // Debounce search (wait 500ms after user stops typing)
                searchRunnable = Runnable {
                    // Reset pagination for new search
                    currentOffset = 0
                    hasMoreProducts = true
                    products.clear()
                    loadProducts(initialLoad = false, searchQuery = query)
                }
                searchHandler.postDelayed(searchRunnable!!, 500)
            }
        })
    }

    private fun filterProducts(query: String, fromSearch: Boolean = false) {
        filteredProducts.clear()
        if (query.isBlank()) {
            filteredProducts.addAll(products)
        } else {
            val lowerQuery = query.lowercase()
            filteredProducts.addAll(products.filter {
                it.name.lowercase().contains(lowerQuery)
            })
        }
        adapter.notifyDataSetChanged()
        
        // If searching and we have a search query, reset pagination and load from server
        if (fromSearch && query.isNotBlank()) {
            currentOffset = 0
            hasMoreProducts = true
            products.clear()
            loadProducts(initialLoad = false, searchQuery = query)
        }
    }
    
    // Removed setupLoadMoreButton - now using infinite scroll

    private fun setupViewCartButton() {
        updateCartButton()
        binding.viewCartButton.setOnClickListener {
            val intent = Intent(this, PosCartActivity::class.java)
            intent.putParcelableArrayListExtra(CART_EXTRA, ArrayList(cart))
            startActivityForResult(intent, RESULT_CART_UPDATED)
        }
    }

    private fun updateCartButton() {
        val itemCount = cart.sumOf { it.quantity }
        binding.viewCartButton.text = "View Cart ($itemCount)"
    }

    private fun addToCart(product: PosProduct) {
        val availableStock = product.stock ?: 0
        
        if (availableStock <= 0) {
            Toast.makeText(this, "Stock is 0 for ${product.name}", Toast.LENGTH_SHORT).show()
            return
        }

        // Check if product has multiple capacities with pricing
        // Handle both 'capacity' and 'size' field names, and 'price' field
        val capacitiesWithPricing = product.capacityPricing
            ?.filter { 
                val cap = it.effectiveCapacity
                val price = it.effectivePrice ?: 0.0
                cap != null && cap.isNotBlank() && price > 0
            }
            ?.distinctBy { it.effectiveCapacity } // Deduplicate by capacity
            ?: emptyList()

        if (capacitiesWithPricing.size > 1) {
            // Show capacity selection dialog
            showCapacitySelectionDialog(product, capacitiesWithPricing, availableStock)
        } else {
            // Single capacity or no capacity pricing - add directly
            addProductToCart(product, availableStock, null, null)
        }
    }

    private fun showCapacitySelectionDialog(
        product: PosProduct,
        capacities: List<CapacityPricing>,
        availableStock: Int
    ) {
        val capacityOptions = capacities.map { pricing ->
            val capacity = pricing.effectiveCapacity ?: ""
            val price = (pricing.effectivePrice ?: 0.0).toInt()
            val stock = capacityStockForDisplay(product, capacity)
            "$capacity - KES $price (Stock: $stock)"
        }.toTypedArray()

        val selectedIndex = intArrayOf(0) // Default to first option

        AlertDialog.Builder(this)
            .setTitle("Select Capacity")
            .setSingleChoiceItems(capacityOptions, 0) { _, which ->
                selectedIndex[0] = which
            }
            .setPositiveButton("Add to Cart") { _, _ ->
                val selectedPricing = capacities[selectedIndex[0]]
                val selectedCapacity = selectedPricing.effectiveCapacity ?: ""
                val selectedPrice = selectedPricing.effectivePrice ?: product.price
                val multiplier = capacityUnitMultiplier(selectedCapacity)
                val capacityStock = if (multiplier > 1) (availableStock / multiplier) else availableStock
                addProductToCart(product, capacityStock, selectedCapacity, selectedPrice)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun addProductToCart(
        product: PosProduct,
        availableStock: Int,
        selectedCapacity: String?,
        selectedPrice: Double?
    ) {
        val capacityKey = (selectedCapacity ?: "").trim()
        val existingItem = cart.find { it.drinkId == product.id && (it.capacity ?: "").trim() == capacityKey }
        
        if (existingItem != null) {
            // Check if adding more would exceed stock
            if (existingItem.quantity >= availableStock) {
                Toast.makeText(this, "Cannot add more. Stock is ${availableStock} for ${product.name}", Toast.LENGTH_SHORT).show()
                return
            }
            existingItem.quantity++
        } else {
            // Determine capacity and price
            val cartCapacity = selectedCapacity ?: run {
                if (product.capacityPricing?.isNotEmpty() == true) {
                    product.capacityPricing.firstOrNull()?.effectiveCapacity ?: product.capacityDisplay
                } else {
                    product.capacityDisplay
                }
            }
            
            val cartPrice = selectedPrice ?: product.price
            
            cart.add(PosCartItem(
                drinkId = product.id,
                name = product.name,
                capacity = cartCapacity,
                price = cartPrice,
                quantity = 1,
                availableStock = availableStock,
                purchasePrice = product.purchasePrice
            ))
        }

        // Update product stock in the list
        val productIndex = products.indexOfFirst { it.id == product.id }
        if (productIndex >= 0) {
            val units = capacityUnitMultiplier(selectedCapacity)
            products[productIndex] = product.copy(stock = (product.stock ?: 0) - units)
            filterProducts(binding.searchEditText.text.toString())
        }

        updateCartButton()
        // Save cart to SharedPrefs when items are added
        SharedPrefs.savePosCart(this, cart)
        Toast.makeText(this, "Added ${product.name} to cart", Toast.LENGTH_SHORT).show()
    }

    private fun loadProducts(initialLoad: Boolean = false, searchQuery: String? = null) {
        if (isLoading) {
            android.util.Log.d("PosProductListActivity", "Already loading, skipping duplicate request")
            return
        }
        
        isLoading = true
        // Only show loading indicator on initial load, not for lazy loading
        if (initialLoad) {
            binding.loadingProgress.visibility = View.VISIBLE
        }
        
        val query = searchQuery ?: binding.searchEditText.text.toString().trim()
        
        // Start API call immediately without waiting
        lifecycleScope.launch {
            try {
                // Ensure API client is initialized (should already be done in onCreate)
                if (!ApiClient.isInitialized()) {
                    ApiClient.init(this@PosProductListActivity)
                }
                
                // Make API call immediately
                val response = ApiClient.getApiService().getPosDrinks(
                    search = if (query.isBlank()) null else query,
                    limit = pageSize,
                    offset = currentOffset
                )
                
                if (response.isSuccessful) {
                    val responseBody = response.body()
                    if (responseBody != null) {
                        val newProducts = responseBody.products
                        
                        if (initialLoad || currentOffset == 0) {
                            products.clear()
                            filteredProducts.clear()
                        }
                        
                        products.addAll(newProducts)
                        hasMoreProducts = responseBody.hasMore
                        currentOffset += newProducts.size
                        
                        // Update filtered products (no server call needed, just filter local list)
                        filterProducts(query, fromSearch = false)
                        
                        // Hide loader after first set of products is displayed
                        if (initialLoad) {
                            binding.loadingProgress.visibility = View.GONE
                        }
                    } else {
                        Toast.makeText(this@PosProductListActivity, "Failed to load products", Toast.LENGTH_SHORT).show()
                        if (initialLoad) {
                            binding.loadingProgress.visibility = View.GONE
                        }
                    }
                } else {
                    Toast.makeText(this@PosProductListActivity, "Failed to load products", Toast.LENGTH_SHORT).show()
                    if (initialLoad) {
                        binding.loadingProgress.visibility = View.GONE
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PosProductListActivity", "Error loading products: ${e.message}", e)
                binding.loadingProgress.visibility = View.GONE
                Toast.makeText(this@PosProductListActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            } finally {
                isLoading = false
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RESULT_CART_UPDATED && resultCode == RESULT_OK) {
            val updatedCart = data?.getParcelableArrayListExtra<PosCartItem>(CART_EXTRA)
            if (updatedCart != null) {
                cart.clear()
                cart.addAll(updatedCart)
                // Save updated cart to SharedPrefs
                SharedPrefs.savePosCart(this, cart)
                updateCartButton()
                // Reload products to refresh stock
                currentOffset = 0
                hasMoreProducts = true
                loadProducts(initialLoad = true)
            }
        }
    }

    inner class ProductAdapter(
        private val items: List<PosProduct>,
        private val onItemClick: (PosProduct) -> Unit
    ) : RecyclerView.Adapter<ProductAdapter.ViewHolder>() {

        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val productNameText: TextView = view.findViewById(R.id.productNameText)
            val capacityText: TextView = view.findViewById(R.id.capacityText)
            val quantityText: TextView = view.findViewById(R.id.quantityText)
            val priceText: TextView = view.findViewById(R.id.priceText)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_pos_product, parent, false)
            return ViewHolder(view)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val product = items[position]
            holder.productNameText.text = product.name
            
            // Display capacities with price + stock
            val capacityRows = product.capacityPricing
                ?.filter { it.effectiveCapacity?.isNotBlank() == true && (it.effectivePrice ?: 0.0) > 0 }
                ?.distinctBy { it.effectiveCapacity }
                ?.map { pricing ->
                    val capacity = pricing.effectiveCapacity ?: ""
                    val price = (pricing.effectivePrice ?: 0.0).toInt()
                    "$capacity - KES $price (Stock: ${capacityStockForDisplay(product, capacity)})"
                }
                ?: emptyList()
            if (capacityRows.isNotEmpty()) {
                holder.capacityText.text = capacityRows.joinToString("\n")
                holder.capacityText.visibility = android.view.View.VISIBLE
            } else {
                // Fallback to simple capacity list if no pricing available
                val simpleCapacity = product.capacity?.joinToString(", ")
                if (simpleCapacity != null) {
                    holder.capacityText.text = simpleCapacity
                    holder.capacityText.visibility = android.view.View.VISIBLE
                } else {
                    holder.capacityText.visibility = android.view.View.GONE
                }
            }
            
            holder.quantityText.text = "${product.stock ?: 0}"
            holder.priceText.text = currencyFormatter.format(product.price)
            
            holder.itemView.setOnClickListener {
                onItemClick(product)
            }
        }

        override fun getItemCount() = items.size
    }
}
