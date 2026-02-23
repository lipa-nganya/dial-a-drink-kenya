package com.dialadrink.driver.ui.common

import android.graphics.Typeface
import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StyleSpan
import android.text.style.TextAppearanceSpan
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityTermsPrivacyBinding

class TermsOfUseActivity : AppCompatActivity() {
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
        supportActionBar?.title = "Terms of Use"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun displayContent(userType: String) {
        val content = when (userType) {
            "driver" -> getDriverTermsOfUse()
            "admin" -> getAdminTermsOfUse()
            "shop_agent" -> getShopAgentTermsOfUse()
            else -> getDriverTermsOfUse()
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
    
    private fun getDriverTermsOfUse(): String {
        return """
            TERMS OF USE
            Last Updated: ${java.text.SimpleDateFormat("MMMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date())}
            
            1. ACCEPTANCE OF TERMS
            By accessing and using the Dial a Drink Kenya Driver App, you agree to be bound by these Terms of Use. If you do not agree, please do not use the app.
            
            2. DRIVER RESPONSIBILITIES
            As a driver using this app, you agree to:
            • Maintain a valid driver's license and all required permits
            • Follow all traffic laws and regulations
            • Deliver orders safely and in a timely manner
            • Verify customer age when delivering alcoholic beverages
            • Maintain the security of your account credentials
            • Report any issues or incidents immediately
            • Treat customers with respect and professionalism
            
            3. ORDER ACCEPTANCE AND DELIVERY
            • You have the right to accept or reject order assignments
            • Once accepted, you are responsible for completing the delivery
            • Delivery times should be reasonable and communicated to customers
            • You must verify customer identity and age for alcohol deliveries
            • Follow all delivery instructions provided
            
            4. PAYMENT AND COMPENSATION
            • Payment terms are as agreed with Dial a Drink Kenya
            • You are responsible for accurate reporting of deliveries
            • Any disputes regarding payment should be reported promptly
            
            5. PROHIBITED ACTIVITIES
            You agree NOT to:
            • Use the app while driving (use hands-free options)
            • Accept orders while under the influence of alcohol or drugs
            • Share your account credentials with others
            • Manipulate or falsify delivery information
            • Engage in any fraudulent activity
            • Harass or mistreat customers
            
            6. DATA AND PRIVACY
            • Your location data may be tracked during active deliveries
            • Order information is shared with you to complete deliveries
            • Customer information must be kept confidential
            • See Privacy Policy for more details
            
            7. TERMINATION
            Dial a Drink Kenya reserves the right to suspend or terminate your access to the app for violations of these terms.
            
            8. LIMITATION OF LIABILITY
            Dial a Drink Kenya shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.
            
            9. CHANGES TO TERMS
            We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance.
            
            10. CONTACT INFORMATION
            For questions about these Terms of Use, please contact Dial a Drink Kenya support.
        """.trimIndent()
    }
    
    private fun getAdminTermsOfUse(): String {
        return """
            TERMS OF USE
            Last Updated: ${java.text.SimpleDateFormat("MMMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date())}
            
            1. ACCEPTANCE OF TERMS
            By accessing and using the Dial a Drink Kenya Admin App, you agree to be bound by these Terms of Use. If you do not agree, please do not use the app.
            
            2. ADMIN RESPONSIBILITIES
            As an administrator using this app, you agree to:
            • Maintain the security and confidentiality of your account
            • Use administrative privileges responsibly
            • Protect customer and driver information
            • Follow all company policies and procedures
            • Report any security breaches or issues immediately
            • Ensure accurate order processing and management
            
            3. ACCESS AND PERMISSIONS
            • Your access level is determined by your role (admin/manager)
            • You must not share your credentials with others
            • Unauthorized access attempts are prohibited
            • You are responsible for all actions taken with your account
            
            4. DATA MANAGEMENT
            • You have access to sensitive business and customer data
            • All data must be handled in accordance with privacy regulations
            • Customer information must be kept confidential
            • Data should only be used for legitimate business purposes
            
            5. ORDER AND INVENTORY MANAGEMENT
            • You are responsible for accurate order processing
            • Inventory management must be kept up to date
            • Driver assignments should be fair and appropriate
            • All transactions must be properly recorded
            
            6. PROHIBITED ACTIVITIES
            You agree NOT to:
            • Share your account with unauthorized users
            • Access data outside your authorized scope
            • Manipulate or falsify business records
            • Engage in any fraudulent activity
            • Disclose confidential information to third parties
            • Use the app for personal gain outside company policies
            
            7. SECURITY
            • You must use strong passwords and enable security features
            • Report any suspicious activity immediately
            • Log out when not actively using the app
            • Keep the app updated to the latest version
            
            8. TERMINATION
            Dial a Drink Kenya reserves the right to suspend or terminate your access for violations of these terms or company policies.
            
            9. LIMITATION OF LIABILITY
            Dial a Drink Kenya shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.
            
            10. CHANGES TO TERMS
            We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance.
            
            11. CONTACT INFORMATION
            For questions about these Terms of Use, please contact Dial a Drink Kenya support.
        """.trimIndent()
    }
    
    private fun getShopAgentTermsOfUse(): String {
        return """
            TERMS OF USE
            Last Updated: ${java.text.SimpleDateFormat("MMMM dd, yyyy", java.util.Locale.getDefault()).format(java.util.Date())}
            
            1. ACCEPTANCE OF TERMS
            By accessing and using the Dial a Drink Kenya Shop Agent App, you agree to be bound by these Terms of Use. If you do not agree, please do not use the app.
            
            2. SHOP AGENT RESPONSIBILITIES
            As a shop agent using this app, you agree to:
            • Perform inventory checks accurately and honestly
            • Report discrepancies between physical stock and database records
            • Follow all inventory management procedures
            • Maintain the security of your account credentials
            • Submit inventory checks in a timely manner
            • Cooperate with management for inventory reconciliation
            
            3. INVENTORY CHECK PROCEDURES
            • You must count items accurately and report true counts
            • Flag any discrepancies between your count and database records
            • Provide clear and detailed information when submitting checks
            • Respond to recount requests promptly and accurately
            
            4. DATA ACCURACY
            • All inventory counts must be accurate and truthful
            • You are responsible for the accuracy of your submissions
            • False or misleading information is prohibited
            • Discrepancies should be reported honestly
            
            5. PROHIBITED ACTIVITIES
            You agree NOT to:
            • Falsify inventory counts or reports
            • Share your account credentials with others
            • Manipulate inventory data
            • Engage in any fraudulent activity
            • Access data outside your authorized scope
            • Disclose confidential inventory information
            
            6. RECOUNT REQUESTS
            • Management may request recounts for flagged items
            • You must comply with recount requests promptly
            • Recounts should be performed accurately and honestly
            • Provide any additional information requested
            
            7. DATA AND PRIVACY
            • Inventory data is confidential business information
            • You must not share inventory information with unauthorized parties
            • See Privacy Policy for more details on data handling
            
            8. TERMINATION
            Dial a Drink Kenya reserves the right to suspend or terminate your access for violations of these terms.
            
            9. LIMITATION OF LIABILITY
            Dial a Drink Kenya shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app.
            
            10. CHANGES TO TERMS
            We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance.
            
            11. CONTACT INFORMATION
            For questions about these Terms of Use, please contact Dial a Drink Kenya support.
        """.trimIndent()
    }
}
