package com.dialadrink.driver.ui.shopagent

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.InventoryCheckHistoryItem
import com.dialadrink.driver.data.model.InventoryCheckRequest
import com.dialadrink.driver.data.model.InventoryCheckItem
import com.dialadrink.driver.databinding.FragmentInventoryCheckListBinding
import com.dialadrink.driver.databinding.ItemInventoryCheckHistoryBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class RejectedChecksFragment : Fragment() {
    private var _binding: FragmentInventoryCheckListBinding? = null
    private val binding get() = _binding!!
    
    private var checks = mutableListOf<InventoryCheckHistoryItem>()
    private lateinit var adapter: InventoryCheckHistoryAdapter
    
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentInventoryCheckListBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        adapter = InventoryCheckHistoryAdapter(checks, showRecountButton = true) { check ->
            showRecountDialog(check)
        }
        binding.recyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.recyclerView.adapter = adapter
        
        displayChecks()
    }
    
    fun setChecks(newChecks: List<InventoryCheckHistoryItem>) {
        checks.clear()
        checks.addAll(newChecks)
        if (view != null) {
            displayChecks()
        }
    }
    
    private fun displayChecks() {
        if (checks.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            binding.emptyStateText.text = "No rejected inventory check."
            binding.recyclerView.visibility = View.GONE
        } else {
            binding.emptyStateText.visibility = View.GONE
            binding.recyclerView.visibility = View.VISIBLE
            adapter.notifyDataSetChanged()
        }
    }
    
    private fun showRecountDialog(check: InventoryCheckHistoryItem) {
        var recountCount = check.agentCount
        
        val dialogView = LayoutInflater.from(requireContext()).inflate(R.layout.dialog_recount, null)
        val countText = dialogView.findViewById<android.widget.TextView>(R.id.countText)
        val decreaseButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.decreaseButton)
        val increaseButton = dialogView.findViewById<com.google.android.material.button.MaterialButton>(R.id.increaseButton)
        
        countText.text = recountCount.toString()
        
        decreaseButton.setOnClickListener {
            recountCount = maxOf(0, recountCount - 1)
            countText.text = recountCount.toString()
        }
        
        increaseButton.setOnClickListener {
            recountCount++
            countText.text = recountCount.toString()
        }
        
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Recount: ${check.drink?.name}")
            .setView(dialogView)
            .setMessage("Previous count: ${check.agentCount} | Database count: ${check.databaseCount}\n\n${if (check.notes != null) "Admin notes: ${check.notes}\n\n" else ""}Enter new count:")
            .setPositiveButton("Submit Recount") { _, _ ->
                submitRecount(check, recountCount)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun submitRecount(check: InventoryCheckHistoryItem, newCount: Int) {
        lifecycleScope.launch {
            try {
                val request = InventoryCheckRequest(
                    items = listOf(
                        InventoryCheckItem(
                            drinkId = check.drink?.id ?: 0,
                            count = newCount
                        )
                    )
                )
                
                val response = ApiClient.getApiService().submitInventoryCheck(request)
                
                if (response.isSuccessful) {
                    val apiResponse = response.body()
                    if (apiResponse?.success == true) {
                        Toast.makeText(requireContext(), "Recount submitted successfully", Toast.LENGTH_SHORT).show()
                        // Notify parent activity to refresh
                        (activity as? ShopAgentInventoryCheckHistoryActivity)?.onRecountSubmitted()
                    } else {
                        val errorMessage = apiResponse?.error ?: "Failed to submit recount"
                        Toast.makeText(requireContext(), errorMessage, Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string()
                    Toast.makeText(requireContext(), "Failed to submit recount", Toast.LENGTH_SHORT).show()
                }
            } catch (e: HttpException) {
                Toast.makeText(requireContext(), "Failed to submit recount", Toast.LENGTH_SHORT).show()
            } catch (e: IOException) {
                Toast.makeText(requireContext(), "Network error. Please check your connection.", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "An error occurred", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private inner class InventoryCheckHistoryAdapter(
        private val items: List<InventoryCheckHistoryItem>,
        private val showRecountButton: Boolean,
        private val onRecountClick: (InventoryCheckHistoryItem) -> Unit
    ) : RecyclerView.Adapter<InventoryCheckHistoryAdapter.ViewHolder>() {
        
        inner class ViewHolder(private val binding: ItemInventoryCheckHistoryBinding) : RecyclerView.ViewHolder(binding.root) {
            fun bind(check: InventoryCheckHistoryItem) {
                binding.itemNameText.text = check.drink?.name ?: "Unknown"
                binding.categoryText.text = check.drink?.category?.name ?: "N/A"
                binding.agentCountText.text = check.agentCount.toString()
                
                // Format date
                try {
                    val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                    val date = apiDateFormat.parse(check.createdAt)
                    binding.dateText.text = "Date: ${dateFormat.format(date)}"
                } catch (e: Exception) {
                    binding.dateText.text = "Date: ${check.createdAt}"
                }
                
                // Show notes if present
                if (check.notes != null && check.notes.isNotEmpty()) {
                    binding.notesText.visibility = View.VISIBLE
                    binding.notesText.text = "Admin notes: ${check.notes}"
                } else {
                    binding.notesText.visibility = View.GONE
                }
                
                // Show recount button for rejected items
                if (showRecountButton) {
                    binding.recountButton.visibility = View.VISIBLE
                    binding.recountButton.setOnClickListener {
                        onRecountClick(check)
                    }
                } else {
                    binding.recountButton.visibility = View.GONE
                }
            }
        }
        
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val binding = ItemInventoryCheckHistoryBinding.inflate(LayoutInflater.from(parent.context), parent, false)
            return ViewHolder(binding)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            holder.bind(items[position])
        }
        
        override fun getItemCount() = items.size
    }
}
