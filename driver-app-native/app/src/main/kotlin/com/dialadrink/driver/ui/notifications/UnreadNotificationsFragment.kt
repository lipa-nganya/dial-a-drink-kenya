package com.dialadrink.driver.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.model.Notification
import com.dialadrink.driver.databinding.FragmentNotificationsListBinding
import com.dialadrink.driver.ui.notifications.NotificationsActivity
import com.google.android.material.card.MaterialCardView
import java.text.SimpleDateFormat
import java.util.*

class UnreadNotificationsFragment : Fragment() {
    private var _binding: FragmentNotificationsListBinding? = null
    private val binding get() = _binding!!
    
    private var notifications = mutableListOf<Notification>()
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val dayFormat = SimpleDateFormat("EEEE, MMM dd, yyyy", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val todayFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val apiDateFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentNotificationsListBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        displayNotifications()
    }
    
    fun setNotifications(newNotifications: List<Notification>) {
        notifications.clear()
        notifications.addAll(newNotifications)
        if (view != null) {
            displayNotifications()
        }
    }
    
    private fun displayNotifications() {
        val binding = _binding ?: return
        val container = binding.notificationsContainer
        
        // Remove only notification cards, not the empty state text
        val childCount = container.childCount
        for (i in childCount - 1 downTo 0) {
            val child = container.getChildAt(i)
            if (child !is TextView || child.id != R.id.emptyStateText) {
                container.removeViewAt(i)
            }
        }
        
        if (notifications.isEmpty()) {
            binding.emptyStateText.visibility = View.VISIBLE
            binding.emptyStateText.text = "No unread messages"
            return
        }
        
        binding.emptyStateText.visibility = View.GONE
        
        // Group notifications by day
        val groupedByDay = notifications.groupBy { notification ->
            try {
                val date = parseDate(notification.sentAt)
                todayFormat.format(date)
            } catch (e: Exception) {
                // If parsing fails, use current date
                todayFormat.format(Date())
            }
        }
        
        // Sort days in descending order (newest first)
        val sortedDays = groupedByDay.keys.sortedDescending()
        
        // Get today's date string for comparison
        val todayString = todayFormat.format(Date())
        
        sortedDays.forEach { dayString ->
            val dayNotifications = groupedByDay[dayString] ?: emptyList()
            
            // Add day header
            val dayHeader = LayoutInflater.from(requireContext()).inflate(
                R.layout.item_day_header,
                container,
                false
            ) as TextView
            
            // Format day header text
            val dayDate = try {
                todayFormat.parse(dayString) ?: Date()
            } catch (e: Exception) {
                Date()
            }
            
            val dayHeaderText = when (dayString) {
                todayString -> "Today"
                else -> dayFormat.format(dayDate)
            }
            dayHeader.text = dayHeaderText
            container.addView(dayHeader)
            
            // Add notifications for this day (sorted by time, newest first)
            val sortedNotifications = dayNotifications.sortedByDescending { notification ->
                try {
                    parseDate(notification.sentAt).time
                } catch (e: Exception) {
                    0L
                }
            }
            
            sortedNotifications.forEach { notification ->
                val cardView = LayoutInflater.from(requireContext()).inflate(
                    R.layout.item_notification,
                    container,
                    false
                )
                val card = cardView as MaterialCardView
                
                val titleText = card.findViewById<TextView>(R.id.titleText)
                val previewText = card.findViewById<TextView>(R.id.previewText)
                val dateText = card.findViewById<TextView>(R.id.dateText)
                
                titleText.text = notification.title
                previewText.text = notification.preview
                
                // Format time only (HH:mm format)
                try {
                    val date = parseDate(notification.sentAt)
                    dateText.text = timeFormat.format(date)
                } catch (e: Exception) {
                    dateText.text = notification.sentAt
                }
                
                // Open notification detail when clicked
                card.setOnClickListener {
                    // Mark as read if unread
                    if (!notification.isRead) {
                        (activity as? NotificationsActivity)?.markAsRead(notification.id)
                    }
                    // Open detail screen
                    NotificationDetailActivity.start(requireContext(), notification)
                }
                
                container.addView(card)
            }
        }
    }
    
    private fun parseDate(dateString: String): Date {
        return try {
            apiDateFormat.parse(dateString) ?: apiDateFormat2.parse(dateString) ?: Date()
        } catch (e: Exception) {
            try {
                apiDateFormat2.parse(dateString) ?: Date()
            } catch (e2: Exception) {
                Date()
            }
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
