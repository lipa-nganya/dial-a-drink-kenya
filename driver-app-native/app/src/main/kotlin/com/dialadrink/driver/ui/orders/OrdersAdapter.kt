package com.dialadrink.driver.ui.orders

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.dialadrink.driver.R
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.databinding.ItemOrderBinding
import java.text.NumberFormat
import java.util.*

class OrdersAdapter(
    private val onOrderClick: (Order) -> Unit
) : ListAdapter<Order, OrdersAdapter.OrderViewHolder>(OrderDiffCallback()) {
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): OrderViewHolder {
        val binding = ItemOrderBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return OrderViewHolder(binding, onOrderClick)
    }
    
    override fun onBindViewHolder(holder: OrderViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
    
    class OrderViewHolder(
        private val binding: ItemOrderBinding,
        private val onOrderClick: (Order) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(order: Order) {
            binding.orderNumberText.text = "Order #${order.id}"
            binding.customerNameText.text = order.customerName
            binding.addressText.text = order.deliveryAddress
            
            val formatter = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
            binding.amountText.text = formatter.format(order.totalAmount)
            
            binding.statusChip.text = order.status.replace("_", " ").capitalize()
            
            binding.root.setOnClickListener {
                onOrderClick(order)
            }
        }
    }
    
    class OrderDiffCallback : DiffUtil.ItemCallback<Order>() {
        override fun areItemsTheSame(oldItem: Order, newItem: Order): Boolean {
            return oldItem.id == newItem.id
        }
        
        override fun areContentsTheSame(oldItem: Order, newItem: Order): Boolean {
            return oldItem == newItem
        }
    }
}


