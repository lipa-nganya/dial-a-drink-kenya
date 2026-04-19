package com.dialadrink.driver.ui.shopagent

import android.content.Intent
import android.os.Bundle
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
import com.dialadrink.driver.databinding.ActivityCheckedItemsBinding
import com.dialadrink.driver.databinding.ItemCheckedInventoryItemBinding
import com.dialadrink.driver.utils.SharedPrefs
import android.text.Editable
import android.text.TextWatcher
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

class CheckedItemsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCheckedItemsBinding
    private val TAG = "CheckedItems"
    
    private val checkedItems = mutableListOf<CountedInventoryItem>()
    private lateinit var adapter: CheckedItemsAdapter
    
    enum class CheckedItemAction {
        INCREASE, DECREASE, DELETE
    }
    
    companion object {
        const val CHECKED_ITEMS_EXTRA = "checked_items"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCheckedItemsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupRecyclerView()
        setupListeners()
        
        // Load checked items from intent
        val itemsFromIntent = intent.getParcelableArrayListExtra<CountedInventoryItem>(CHECKED_ITEMS_EXTRA)
        if (itemsFromIntent != null && itemsFromIntent.isNotEmpty()) {
            checkedItems.clear()
            checkedItems.addAll(itemsFromIntent)
        }
        
        adapter.notifyDataSetChanged()
        updateSubmitButton()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Checked Items"
    }
    
    private fun setupRecyclerView() {
        adapter = CheckedItemsAdapter(checkedItems) { item, action ->
            when (action) {
                CheckedItemAction.INCREASE -> increaseCount(item)
                CheckedItemAction.DECREASE -> decreaseCount(item)
                CheckedItemAction.DELETE -> deleteItem(item)
            }
        }
        binding.checkedItemsRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.checkedItemsRecyclerView.adapter = adapter
    }
    
    private fun setupListeners() {
        binding.addItemsButton.setOnClickListener {
            // Return to inventory check screen
            val resultIntent = Intent()
            resultIntent.putParcelableArrayListExtra(CHECKED_ITEMS_EXTRA, ArrayList(checkedItems))
            setResult(RESULT_OK, resultIntent)
            finish()
        }
        
        binding.submitButton.setOnClickListener {
            submitInventoryCheck()
        }
    }
    
    private fun increaseCount(item: CountedInventoryItem) {
        item.count++
        adapter.notifyDataSetChanged()
        updateSubmitButton()
    }
    
    private fun decreaseCount(item: CountedInventoryItem) {
        if (item.count > 0) {
            item.count--
            adapter.notifyDataSetChanged()
            updateSubmitButton()
        }
    }
    
    private fun deleteItem(item: CountedInventoryItem) {
        checkedItems.remove(item)
        adapter.notifyDataSetChanged()
        updateSubmitButton()
    }
    
    private fun updateSubmitButton() {
        val itemCount = checkedItems.size
        binding.submitButton.text = "Submit Inventory Check ($itemCount items)"
        binding.submitButton.isEnabled = checkedItems.isNotEmpty()
    }

    /** Prefer explicit capacity; if missing and stock is only in one bucket, send that key for correct stockByCapacity updates. */
    private fun effectiveCapacityForSubmit(countedItem: CountedInventoryItem): String? {
        countedItem.capacity?.trim()?.takeIf { it.isNotBlank() }?.let { return it }
        val keys = countedItem.item.stockByCapacity?.keys
            ?.mapNotNull { it.trim().takeIf { k -> k.isNotBlank() } }
            ?.distinct()
            ?: emptyList()
        return keys.singleOrNull()
    }
    
    private fun submitInventoryCheck() {
        if (checkedItems.isEmpty()) {
            Toast.makeText(this, "Please add at least one item with a count", Toast.LENGTH_SHORT).show()
            return
        }
        
        val itemsToSubmit = checkedItems.map { countedItem ->
            InventoryCheckItem(
                drinkId = countedItem.item.id,
                count = countedItem.count,
                capacity = effectiveCapacityForSubmit(countedItem)
            )
        }
        
        val request = InventoryCheckRequest(items = itemsToSubmit)
        
        lifecycleScope.launch {
            try {
                binding.progressBar.visibility = View.VISIBLE
                binding.submitButton.isEnabled = false
                
                val response = ApiClient.getApiService().submitInventoryCheck(request)
                
                if (response.isSuccessful) {
                    val apiResponse = response.body()
                    Log.d(TAG, "📦 Submit response: $apiResponse")
                    Log.d(TAG, "📦 Submit response success: ${apiResponse?.success}")
                    Log.d(TAG, "📦 Submit response data: ${apiResponse?.data}")
                    Log.d(TAG, "📦 Submit response data type: ${apiResponse?.data?.javaClass?.simpleName}")
                    
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
                        val checkResponse = apiResponse.data
                        if (checkResponse != null) {
                            val resultCount = checkResponse.results?.size ?: 0
                            Toast.makeText(
                                this@CheckedItemsActivity,
                                "Inventory check submitted successfully for $resultCount item(s)",
                                Toast.LENGTH_LONG
                            ).show()
                            
                            // Clear checked items
                            checkedItems.clear()
                            SharedPrefs.clearCheckedItems(this@CheckedItemsActivity)
                            adapter.notifyDataSetChanged()
                            updateSubmitButton()
                            
                            // Return to inventory check screen
                            val resultIntent = Intent()
                            resultIntent.putParcelableArrayListExtra(CHECKED_ITEMS_EXTRA, ArrayList(checkedItems))
                            setResult(RESULT_OK, resultIntent)
                            finish()
                            
                            Log.d(TAG, "✅ Inventory check submitted successfully")
                        } else {
                            Log.e(TAG, "❌ CheckResponse is null. apiResponse.data: $checkResponse")
                            val errorMessage = apiResponse?.error ?: "Failed to submit inventory check"
                            Toast.makeText(this@CheckedItemsActivity, errorMessage, Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Log.e(TAG, "❌ Response success is false or null. Response: $apiResponse")
                        val errorMessage = apiResponse?.data?.errors?.firstOrNull()?.error 
                            ?: apiResponse?.data?.message
                            ?: apiResponse?.error
                            ?: "Failed to submit inventory check"
                        Toast.makeText(this@CheckedItemsActivity, errorMessage, Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    Log.e(TAG, "❌ Failed to submit: ${response.code()} - $errorBody")
                    Toast.makeText(this@CheckedItemsActivity, "Failed to submit inventory check", Toast.LENGTH_SHORT).show()
                }
            } catch (e: HttpException) {
                Log.e(TAG, "❌ HTTP error: ${e.code()} - ${e.message()}")
                Toast.makeText(this@CheckedItemsActivity, "Failed to submit inventory check", Toast.LENGTH_SHORT).show()
            } catch (e: IOException) {
                Log.e(TAG, "❌ Network error: ${e.message}")
                Toast.makeText(this@CheckedItemsActivity, "Network error. Please check your connection.", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e(TAG, "❌ Unexpected error: ${e.message}", e)
                Toast.makeText(this@CheckedItemsActivity, "An error occurred", Toast.LENGTH_SHORT).show()
            } finally {
                binding.progressBar.visibility = View.GONE
                binding.submitButton.isEnabled = true
            }
        }
    }
    
    override fun onSupportNavigateUp(): Boolean {
        // Return checked items to previous screen
        val resultIntent = Intent()
        resultIntent.putParcelableArrayListExtra(CHECKED_ITEMS_EXTRA, ArrayList(checkedItems))
        setResult(RESULT_OK, resultIntent)
        finish()
        return true
    }
    
    // Checked Items Adapter
    private inner class CheckedItemsAdapter(
        private val items: MutableList<CountedInventoryItem>,
        private val onAction: (CountedInventoryItem, CheckedItemAction) -> Unit
    ) : RecyclerView.Adapter<CheckedItemsAdapter.ViewHolder>() {
        
        inner class ViewHolder(
            private val binding: ItemCheckedInventoryItemBinding
        ) : RecyclerView.ViewHolder(binding.root) {
            
            fun bind(item: CountedInventoryItem) {
                binding.itemNameText.text = item.item.name
                binding.itemCategoryText.text = item.item.category?.name ?: "No category"
                // Remove any previous watcher attached to this view
                (binding.countEditText.tag as? TextWatcher)?.let { old ->
                    binding.countEditText.removeTextChangedListener(old)
                }

                binding.countEditText.setText(item.count.toString())
                binding.countEditText.setSelection(binding.countEditText.text?.length ?: 0)

                val watcher = object : TextWatcher {
                    override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                    override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                    override fun afterTextChanged(s: Editable?) {
                        val raw = s?.toString() ?: ""
                        val digitsOnly = raw.replace(Regex("[^0-9]"), "")
                        if (raw != digitsOnly) {
                            binding.countEditText.setText(digitsOnly)
                            binding.countEditText.setSelection(digitsOnly.length)
                            return
                        }
                        val next = digitsOnly.toIntOrNull() ?: 0
                        item.count = next.coerceAtLeast(0)
                        updateSubmitButton()
                    }
                }
                binding.countEditText.addTextChangedListener(watcher)
                binding.countEditText.tag = watcher

                if (!item.capacity.isNullOrBlank()) {
                    binding.capacityText.visibility = View.VISIBLE
                    binding.capacityText.text = "Capacity: ${item.capacity}"
                } else {
                    binding.capacityText.visibility = View.GONE
                }

                binding.increaseButton.setOnClickListener {
                    onAction(item, CheckedItemAction.INCREASE)
                    binding.countEditText.setText(item.count.toString())
                    binding.countEditText.setSelection(binding.countEditText.text?.length ?: 0)
                }
                
                binding.decreaseButton.setOnClickListener {
                    onAction(item, CheckedItemAction.DECREASE)
                    binding.countEditText.setText(item.count.toString())
                    binding.countEditText.setSelection(binding.countEditText.text?.length ?: 0)
                }
                
                binding.deleteButton.setOnClickListener {
                    onAction(item, CheckedItemAction.DELETE)
                }
            }
        }
        
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemCheckedInventoryItemBinding.inflate(
                LayoutInflater.from(parent.context), parent, false
            )
            return ViewHolder(binding)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(items[position])
        }
        
        override fun getItemCount() = items.size
    }
}
