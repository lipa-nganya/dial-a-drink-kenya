package com.dialadrink.driver.ui.shopagent

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.dialadrink.driver.databinding.FragmentInventoryCheckListBinding
import com.dialadrink.driver.databinding.ItemInventoryCheckHistoryBinding
import com.dialadrink.driver.data.model.InventoryCheckHistoryItem
import java.text.SimpleDateFormat
import java.util.*

class ApprovedChecksFragment : Fragment() {
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
        
        adapter = InventoryCheckHistoryAdapter(checks, showRecountButton = false) { }
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
            binding.emptyStateText.text = "No approved inventory checks yet."
            binding.recyclerView.visibility = View.GONE
        } else {
            binding.emptyStateText.visibility = View.GONE
            binding.recyclerView.visibility = View.VISIBLE
            adapter.notifyDataSetChanged()
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
                
                // Hide notes and recount button for approved
                binding.notesText.visibility = View.GONE
                binding.recountButton.visibility = View.GONE
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
