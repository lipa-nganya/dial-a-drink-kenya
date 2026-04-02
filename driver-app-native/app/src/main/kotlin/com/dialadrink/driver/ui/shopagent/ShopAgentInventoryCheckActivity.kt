package com.dialadrink.driver.ui.shopagent

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
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
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityShopAgentInventoryCheckBinding
import com.dialadrink.driver.databinding.ItemInventoryProductBinding
import com.dialadrink.driver.utils.SharedPrefs
import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

class ShopAgentInventoryCheckActivity : AppCompatActivity() {
    private lateinit var binding: ActivityShopAgentInventoryCheckBinding
    private val TAG = "ShopAgentInventoryCheck"
    
    private var allItems: List<ShopAgentInventoryItem> = emptyList()
    private val filteredItems = mutableListOf<ShopAgentInventoryItem>()
    private val checkedItems = mutableListOf<CountedInventoryItem>()
    private lateinit var adapter: InventoryProductAdapter
    private var searchHandler = Handler(Looper.getMainLooper())
    private var searchRunnable: Runnable? = null
    
    companion object {
        const val CHECKED_ITEMS_EXTRA = "checked_items"
        const val RESULT_CHECKED_ITEMS_UPDATED = 100
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityShopAgentInventoryCheckBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupRecyclerView()
        setupSearch()
        setupCheckedItemsButton()
        
        // Load checked items from intent or SharedPrefs
        val itemsFromIntent = intent.getParcelableArrayListExtra<CountedInventoryItem>(CHECKED_ITEMS_EXTRA)
        if (itemsFromIntent != null && itemsFromIntent.isNotEmpty()) {
            checkedItems.clear()
            checkedItems.addAll(itemsFromIntent)
            saveCheckedItems()
        } else {
            loadCheckedItems()
        }
        
        fetchInventoryItems()
    }
    
    override fun onResume() {
        super.onResume()
        // Reload checked items in case they were updated
        loadCheckedItems()
        updateCheckedItemsButton()
    }
    
    override fun onPause() {
        super.onPause()
        saveCheckedItems()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Inventory Check"
    }
    
    private fun setupRecyclerView() {
        adapter = InventoryProductAdapter(filteredItems) { item ->
            addToCheckedItems(item)
        }
        binding.itemsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.itemsRecyclerView.adapter = adapter
    }
    
    private fun setupSearch() {
        binding.searchEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s.toString().trim()
                
                // Cancel previous search
                searchRunnable?.let { searchHandler.removeCallbacks(it) }
                
                // Debounce search (wait 300ms after user stops typing)
                searchRunnable = Runnable {
                    filterItems(query)
                }
                searchHandler.postDelayed(searchRunnable!!, 300)
            }
        })
    }
    
    private fun setupCheckedItemsButton() {
        updateCheckedItemsButton()
        binding.checkedItemsButton.setOnClickListener {
            val intent = Intent(this, CheckedItemsActivity::class.java)
            intent.putParcelableArrayListExtra(CHECKED_ITEMS_EXTRA, ArrayList(checkedItems))
            startActivityForResult(intent, RESULT_CHECKED_ITEMS_UPDATED)
        }
    }
    
    private fun updateCheckedItemsButton() {
        val itemCount = checkedItems.size
        binding.checkedItemsButton.text = "Checked Items ($itemCount)"
    }
    
    private fun filterItems(query: String) {
        filteredItems.clear()
        if (query.isBlank()) {
            filteredItems.addAll(allItems)
        } else {
            val lowerQuery = query.lowercase()
            filteredItems.addAll(allItems.filter {
                it.name.lowercase().contains(lowerQuery) ||
                (it.barcode?.lowercase()?.contains(lowerQuery) == true)
            })
        }
        adapter.notifyDataSetChanged()
    }
    
    private fun addToCheckedItems(item: ShopAgentInventoryItem) {
        val capacitiesFromCapacity = item.capacity
            ?.filter { it.isNotBlank() }
            ?.takeIf { it.isNotEmpty() }

        val capacitiesFromPricing = item.capacityPricing
            ?.mapNotNull { it.effectiveCapacity }
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            ?.distinct()
            ?.takeIf { it.isNotEmpty() }

        val capacities = capacitiesFromCapacity ?: capacitiesFromPricing ?: emptyList()

        if (capacities.isNotEmpty()) {
            val options = capacities.toTypedArray()
            android.app.AlertDialog.Builder(this)
                .setTitle("Select capacity")
                .setItems(options) { _, which ->
                    val selectedCapacity = options[which]
                    addCountedItem(item, selectedCapacity)
                }
                .setNegativeButton("Cancel", null)
                .show()
        } else {
            addCountedItem(item, null)
        }
    }

    private fun addCountedItem(item: ShopAgentInventoryItem, capacity: String?) {
        val existingItem = checkedItems.find { it.item.id == item.id && it.capacity == capacity }
        if (existingItem != null) {
            existingItem.count++
            Toast.makeText(this, "Count increased for ${item.name}${capacity?.let { " ($it)" } ?: ""}", Toast.LENGTH_SHORT).show()
        } else {
            checkedItems.add(CountedInventoryItem(item, 1, capacity))
            Toast.makeText(this, "${item.name}${capacity?.let { " ($it)" } ?: ""} added to checked items", Toast.LENGTH_SHORT).show()
        }
        saveCheckedItems()
        updateCheckedItemsButton()
    }
    
    private fun saveCheckedItems() {
        SharedPrefs.saveCheckedItems(this, checkedItems)
    }
    
    private fun loadCheckedItems() {
        val saved = SharedPrefs.getCheckedItems(this)
        checkedItems.clear()
        checkedItems.addAll(saved)
        updateCheckedItemsButton()
    }
    
    private fun fetchInventoryItems() {
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                val response = ApiClient.getApiService().getShopAgentInventoryItems()
                Log.d(TAG, "📦 Raw API response: $response")
                
                if (response.isSuccessful) {
                    val apiResponse = response.body()
                    Log.d(TAG, "📦 API Response body: $apiResponse")
                    Log.d(TAG, "📦 API Response success: ${apiResponse?.success}")
                    Log.d(TAG, "📦 API Response data type: ${apiResponse?.data?.javaClass?.simpleName}")
                    Log.d(TAG, "📦 API Response data: ${apiResponse?.data}")
                    
                    // Try to get raw response for debugging
                    try {
                        val rawResponse = response.raw()
                        val source = rawResponse.peekBody(Long.MAX_VALUE)
                        val rawJson = source.string()
                        Log.d(TAG, "📦 Raw JSON response: $rawJson")
                    } catch (e: Exception) {
                        Log.e(TAG, "❌ Could not read raw response: ${e.message}")
                    }
                    
                    if (apiResponse?.success == true) {
                        val itemsResponse = apiResponse.data
                        if (itemsResponse != null) {
                            Log.d(TAG, "📦 ItemsResponse: $itemsResponse")
                            Log.d(TAG, "📦 ItemsResponse success: ${itemsResponse.success}")
                            Log.d(TAG, "📦 ItemsResponse items: ${itemsResponse.items}")
                            
                            if (itemsResponse.items != null) {
                                allItems = itemsResponse.items
                                filterItems(binding.searchEditText.text.toString())
                                Log.d(TAG, "✅ Fetched ${allItems.size} inventory items")
                            } else {
                                Log.e(TAG, "❌ Items array is null in itemsResponse")
                                Toast.makeText(this@ShopAgentInventoryCheckActivity, "Failed to load inventory items", Toast.LENGTH_SHORT).show()
                            }
                        } else {
                            Log.e(TAG, "❌ ItemsResponse is null. apiResponse.data: $itemsResponse")
                            Toast.makeText(this@ShopAgentInventoryCheckActivity, "Failed to load inventory items", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Log.e(TAG, "❌ Response success is false or null. Response: $apiResponse")
                        Toast.makeText(this@ShopAgentInventoryCheckActivity, "Failed to load inventory items", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "❌ Failed to fetch items: ${response.code()} - $errorBody")
                    Toast.makeText(this@ShopAgentInventoryCheckActivity, "Failed to load inventory items", Toast.LENGTH_SHORT).show()
                }
            } catch (e: HttpException) {
                Log.e(TAG, "❌ HTTP error: ${e.code()} - ${e.message()}")
                Toast.makeText(this@ShopAgentInventoryCheckActivity, "Failed to load inventory items", Toast.LENGTH_SHORT).show()
            } catch (e: IOException) {
                Log.e(TAG, "❌ Network error: ${e.message}")
                Toast.makeText(this@ShopAgentInventoryCheckActivity, "Network error. Please check your connection.", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e(TAG, "❌ Unexpected error: ${e.message}", e)
                Toast.makeText(this@ShopAgentInventoryCheckActivity, "An error occurred", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBar.visibility = View.GONE
            }
        }
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == RESULT_CHECKED_ITEMS_UPDATED && resultCode == RESULT_OK) {
            val updatedItems = data?.getParcelableArrayListExtra<CountedInventoryItem>(CHECKED_ITEMS_EXTRA)
            if (updatedItems != null) {
                checkedItems.clear()
                checkedItems.addAll(updatedItems)
                saveCheckedItems()
                updateCheckedItemsButton()
            }
        }
    }
    
    override fun onSupportNavigateUp(): Boolean {
        saveCheckedItems()
        finish()
        return true
    }
    
    // Product Adapter
    private inner class InventoryProductAdapter(
        private val items: MutableList<ShopAgentInventoryItem>,
        private val onItemClick: (ShopAgentInventoryItem) -> Unit
    ) : RecyclerView.Adapter<InventoryProductAdapter.ViewHolder>() {
        
        inner class ViewHolder(
            private val binding: ItemInventoryProductBinding
        ) : RecyclerView.ViewHolder(binding.root) {
            
            fun bind(item: ShopAgentInventoryItem) {
                binding.itemNameText.text = item.name
                binding.itemCategoryText.text = item.category?.name ?: "No category"

                val capacitiesFromCapacity = item.capacity
                    ?.filter { it.isNotBlank() }
                    ?.takeIf { it.isNotEmpty() }

                val capacitiesFromPricing = item.capacityPricing
                    ?.mapNotNull { it.effectiveCapacity }
                    ?.map { it.trim() }
                    ?.filter { it.isNotBlank() }
                    ?.distinct()
                    ?.takeIf { it.isNotEmpty() }

                val capacities = capacitiesFromCapacity ?: capacitiesFromPricing ?: emptyList()

                val stockByCap = item.stockByCapacity
                val stockText = if (capacities.isNotEmpty() && stockByCap != null) {
                    val baseKey = findBaseUnitCapacityKey(stockByCap)
                    val baseCans = (baseKey?.let { stockByCap[it] } ?: item.currentStock).coerceAtLeast(0)

                    capacities.joinToString(", ") { cap ->
                        val multiplier = capacityUnitMultiplier(cap)
                        val normalized = normalizeCapacity(cap)

                        val displayValue = when {
                            multiplier > 1 -> baseCans / multiplier
                            isCanCapacityLabel(normalized) -> baseCans
                            else -> stockByCap[cap] ?: 0
                        }
                        "$cap: $displayValue"
                    }
                } else {
                    "Stock: ${item.currentStock}"
                }
                binding.stockText.text = stockText

                binding.addButton.setOnClickListener {
                    onItemClick(item)
                }
            }
        }
        
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemInventoryProductBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(items[position])
        }
        
        override fun getItemCount() = items.size
    }

    private fun normalizeCapacity(value: String?): String {
        return (value ?: "")
            .toString()
            .trim()
            .lowercase()
            .replace("\\s+".toRegex(), "")
    }

    private fun capacityUnitMultiplier(capacityLabel: String?): Int {
        val raw = (capacityLabel ?: "").trim().lowercase()
        if (raw.isBlank()) return 1

        val compact = raw.replace("\\s+".toRegex(), "")

        // e.g. "6 pack", "12 pk", ...
        val packMatch = compact.matchRegex(Regex("^(\\d+)(pack|pk)$"))
            ?: compact.matchRegex(Regex("^(\\d+)(pack|pk).*$"))

        if (packMatch != null) {
            val n = packMatch.groupValues.getOrNull(1)?.toIntOrNull()
            return if (n != null && n > 0) n else 1
        }

        // e.g. "can", "1 can", "single" -> 1 base unit
        if (compact.contains("can") || compact == "single" || compact == "1can" || compact == "1") return 1

        return 1
    }

    private fun isCanCapacityLabel(normalizedCapacity: String?): Boolean {
        val n = normalizedCapacity ?: ""
        return n.contains("can") || n == "single" || n == "1can" || n == "1"
    }

    private fun findBaseUnitCapacityKey(stockByCapacity: Map<String, Int>?): String? {
        val keys = stockByCapacity?.keys?.orEmpty() ?: emptySet()
        return keys.firstOrNull { key ->
            val n = normalizeCapacity(key)
            n == "can" || n == "1can" || n == "single" || n == "1"
        }
    }
}

private fun String.matchRegex(regex: Regex): MatchResult? = regex.find(this)
