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
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
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
    private val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
    private var currentOffset = 0
    private val pageSize = 10
    private var hasMoreProducts = true
    private var isLoading = false

    companion object {
        const val CART_EXTRA = "cart"
        const val RESULT_CART_UPDATED = 100
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPosProductListBinding.inflate(layoutInflater)
        setContentView(binding.root)

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

        val existingItem = cart.find { it.drinkId == product.id }
        
        if (existingItem != null) {
            // Check if adding more would exceed stock
            if (existingItem.quantity >= availableStock) {
                Toast.makeText(this, "Cannot add more. Stock is ${availableStock} for ${product.name}", Toast.LENGTH_SHORT).show()
                return
            }
            existingItem.quantity++
        } else {
            cart.add(PosCartItem(
                drinkId = product.id,
                name = product.name,
                capacity = product.capacityDisplay,
                price = product.price,
                quantity = 1,
                availableStock = availableStock,
                purchasePrice = product.purchasePrice
            ))
        }

        // Update product stock in the list
        val productIndex = products.indexOfFirst { it.id == product.id }
        if (productIndex >= 0) {
            products[productIndex] = product.copy(stock = (product.stock ?: 0) - 1)
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
            holder.capacityText.text = "Capacity: ${product.capacityDisplay ?: "N/A"}"
            holder.quantityText.text = "${product.stock ?: 0}"
            holder.priceText.text = currencyFormatter.format(product.price)
            
            holder.itemView.setOnClickListener {
                onItemClick(product)
            }
        }

        override fun getItemCount() = items.size
    }
}
