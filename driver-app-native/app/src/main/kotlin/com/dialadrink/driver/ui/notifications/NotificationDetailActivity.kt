package com.dialadrink.driver.ui.notifications

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.dialadrink.driver.databinding.ActivityNotificationDetailBinding
import java.text.SimpleDateFormat
import java.util.*

class NotificationDetailActivity : AppCompatActivity() {
    private lateinit var binding: ActivityNotificationDetailBinding
    
    private val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("Africa/Nairobi")
    }
    private val apiDateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    private val apiDateFormat2 = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityNotificationDetailBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        displayNotification()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Notification"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun displayNotification() {
        val title = intent.getStringExtra("title") ?: ""
        val message = intent.getStringExtra("message") ?: ""
        val sentAt = intent.getStringExtra("sentAt") ?: ""
        
        binding.titleText.text = title
        binding.messageText.text = message
        
        // Format date
        try {
            val date = parseDate(sentAt)
            binding.dateText.text = dateFormat.format(date)
        } catch (e: Exception) {
            binding.dateText.text = sentAt
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
    
    companion object {
        fun start(context: android.content.Context, notification: com.dialadrink.driver.data.model.Notification) {
            val intent = Intent(context, NotificationDetailActivity::class.java).apply {
                putExtra("notificationId", notification.id)
                putExtra("title", notification.title)
                putExtra("message", notification.message)
                putExtra("preview", notification.preview)
                putExtra("sentAt", notification.sentAt)
                putExtra("isRead", notification.isRead)
            }
            context.startActivity(intent)
        }
    }
}
