package com.dialadrink.driver.ui.common

import android.graphics.Typeface
import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StyleSpan
import androidx.appcompat.app.AppCompatActivity
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityTermsPrivacyBinding

class PrivacyPolicyActivity : AppCompatActivity() {
    private lateinit var binding: ActivityTermsPrivacyBinding
    
    companion object {
        const val EXTRA_USER_TYPE = "user_type" // "driver", "admin", "shop_agent"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityTermsPrivacyBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        val userType = intent.getStringExtra(EXTRA_USER_TYPE) ?: "driver"
        
        setupToolbar()
        displayContent(userType)
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Privacy Policy"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun displayContent(userType: String) {
        val content = when (userType) {
            "driver" -> getDriverPrivacyPolicy()
            "admin" -> getAdminPrivacyPolicy()
            "shop_agent" -> getShopAgentPrivacyPolicy()
            else -> getDriverPrivacyPolicy()
        }
        
        // Style the title (first line)
        val spannable = SpannableString(content)
        val titleEndIndex = content.indexOf('\n')
        if (titleEndIndex > 0) {
            spannable.setSpan(
                StyleSpan(Typeface.BOLD),
                0,
                titleEndIndex,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
            // Make title larger
            spannable.setSpan(
                android.text.style.RelativeSizeSpan(1.3f),
                0,
                titleEndIndex,
                Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
        
        binding.contentText.text = spannable
    }
    
    private fun getDriverPrivacyPolicy(): String {
        return """
            PRIVACY POLICY
            Last Updated: ${java.text.SimpleDateFormat("MMMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date())}
            
            1. INFORMATION WE COLLECT
            We collect the following information from drivers:
            • Personal information: name, phone number, email address
            • Location data: GPS coordinates during active deliveries
            • Order information: delivery assignments and history
            • Performance data: delivery times, ratings, and feedback
            • Device information: device ID, app version, and technical data
            • Payment information: for processing driver compensation
            
            2. HOW WE USE YOUR INFORMATION
            We use your information to:
            • Assign and manage delivery orders
            • Track deliveries and calculate compensation
            • Communicate with you about orders and app updates
            • Improve our services and driver experience
            • Ensure safety and security of deliveries
            • Comply with legal and regulatory requirements
            • Provide customer support
            
            3. LOCATION TRACKING
            • Your location is tracked only during active deliveries
            • Location data is used to optimize routes and ensure delivery accuracy
            • You can disable location services, but this may affect app functionality
            • Location data is stored securely and deleted after a reasonable period
            
            4. INFORMATION SHARING
            We may share your information with:
            • Customers: your name and phone number for delivery coordination
            • Payment processors: for processing driver compensation
            • Service providers: who assist in app operations
            • Legal authorities: when required by law
            • We do NOT sell your personal information to third parties
            
            5. DATA SECURITY
            • We implement appropriate security measures to protect your data
            • Your account is protected with secure authentication
            • All data transmission is encrypted
            • However, no method of transmission is 100% secure
            
            6. YOUR RIGHTS
            You have the right to:
            • Access your personal information
            • Request correction of inaccurate data
            • Request deletion of your data (subject to legal requirements)
            • Opt-out of non-essential communications
            • Request a copy of your data
            
            7. DATA RETENTION
            • We retain your data as long as necessary for business purposes
            • Delivery history may be retained for record-keeping
            • Location data is typically deleted after 30 days
            • Account data is retained while your account is active
            
            8. CONTACT US
            For questions about this Privacy Policy or to exercise your rights, please contact Dial a Drink Kenya support.
        """.trimIndent()
    }
    
    private fun getAdminPrivacyPolicy(): String {
        return """
            PRIVACY POLICY
            Last Updated: ${java.text.SimpleDateFormat("MMMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date())}
            
            1. INFORMATION WE COLLECT
            We collect the following information from administrators:
            • Personal information: name, username, email, phone number
            • Account information: role, permissions, access levels
            • Activity logs: actions taken within the admin app
            • Device information: device ID, app version, IP address
            • Business data: orders, inventory, customer information (as part of your role)
            
            2. HOW WE USE YOUR INFORMATION
            We use your information to:
            • Provide access to administrative functions
            • Track and audit administrative activities
            • Ensure security and prevent unauthorized access
            • Communicate important business updates
            • Improve admin app functionality
            • Comply with legal and regulatory requirements
            • Provide technical support
            
            3. ACCESS TO BUSINESS DATA
            • As an administrator, you have access to business and customer data
            • This access is granted based on your role and responsibilities
            • You must handle all data in accordance with company policies
            • Customer data must be kept confidential and used only for business purposes
            
            4. INFORMATION SHARING
            We may share your information with:
            • Other administrators: for business coordination
            • Service providers: who assist in app operations
            • Legal authorities: when required by law
            • We do NOT sell your personal information to third parties
            
            5. DATA SECURITY
            • We implement strong security measures to protect all data
            • Multi-factor authentication may be required
            • All administrative actions are logged
            • Regular security audits are conducted
            • However, no method of transmission is 100% secure
            
            6. YOUR RESPONSIBILITIES
            As an administrator, you must:
            • Keep your account credentials secure
            • Not share your account with others
            • Report any security incidents immediately
            • Follow all company data protection policies
            • Use data only for legitimate business purposes
            
            7. YOUR RIGHTS
            You have the right to:
            • Access your personal information
            • Request correction of inaccurate data
            • Request information about data processing
            • However, business data access is subject to your role and company policies
            
            8. DATA RETENTION
            • Your account data is retained while your account is active
            • Activity logs may be retained for audit purposes
            • Business data retention follows company policies
            • Data may be retained longer if required by law
            
            9. CONTACT US
            For questions about this Privacy Policy, please contact Dial a Drink Kenya support or your system administrator.
        """.trimIndent()
    }
    
    private fun getShopAgentPrivacyPolicy(): String {
        return """
            PRIVACY POLICY
            Last Updated: ${java.text.SimpleDateFormat("MMMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date())}
            
            1. INFORMATION WE COLLECT
            We collect the following information from shop agents:
            • Personal information: name, phone number, email address
            • Account information: role, shop location, access permissions
            • Inventory data: counts, discrepancies, and check history
            • Activity logs: inventory checks performed and submissions
            • Device information: device ID, app version, technical data
            
            2. HOW WE USE YOUR INFORMATION
            We use your information to:
            • Provide access to inventory management functions
            • Track inventory checks and submissions
            • Verify inventory counts and discrepancies
            • Communicate about inventory matters
            • Improve inventory management processes
            • Ensure accuracy of inventory records
            • Comply with legal and regulatory requirements
            
            3. INVENTORY DATA
            • Inventory data you submit is used for business operations
            • Your counts are compared with database records
            • Discrepancies may trigger management review
            • Inventory data is confidential business information
            
            4. INFORMATION SHARING
            We may share your information with:
            • Management: for inventory reconciliation and review
            • Other authorized personnel: for inventory management
            • Service providers: who assist in app operations
            • Legal authorities: when required by law
            • We do NOT sell your personal information to third parties
            
            5. DATA SECURITY
            • We implement appropriate security measures to protect your data
            • Your account is protected with secure authentication
            • All data transmission is encrypted
            • Inventory data is stored securely
            • However, no method of transmission is 100% secure
            
            6. YOUR RESPONSIBILITIES
            As a shop agent, you must:
            • Keep your account credentials secure
            • Not share your account with others
            • Report any security incidents immediately
            • Keep inventory information confidential
            • Use the app only for authorized inventory checks
            
            7. YOUR RIGHTS
            You have the right to:
            • Access your personal information
            • Request correction of inaccurate data
            • Request information about data processing
            • However, inventory data access is subject to your role
            
            8. DATA RETENTION
            • Your account data is retained while your account is active
            • Inventory check history is retained for business records
            • Activity logs may be retained for audit purposes
            • Data may be retained longer if required by law
            
            9. CONTACT US
            For questions about this Privacy Policy, please contact Dial a Drink Kenya support or your manager.
        """.trimIndent()
    }
}
