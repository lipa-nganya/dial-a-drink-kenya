package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.viewpager2.widget.ViewPager2
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityMyWalletBinding
import com.dialadrink.driver.ui.auth.PinVerificationDialog
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.tabs.TabLayout
import com.google.android.material.tabs.TabLayoutMediator

class MyWalletActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMyWalletBinding
    private var isContentVisible = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMyWalletBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Hide content initially until PIN is verified
        binding.root.visibility = android.view.View.GONE
        
        // Always require PIN verification for Savings screen
        showPinVerification()
    }
    
    private fun showPinVerification() {
        val dialog = PinVerificationDialog()
        dialog.setOnVerifiedListener {
            initializeContent()
        }
        dialog.setOnCancelledListener {
            finish()
        }
        dialog.show(supportFragmentManager, "PinVerificationDialog")
    }
    
    private fun initializeContent() {
        isContentVisible = true
        binding.root.visibility = android.view.View.VISIBLE
        setupToolbar()
        setupViewPager()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    override fun onResume() {
        super.onResume()
        
        // Always require PIN verification when returning to this screen
        if (isContentVisible) {
            // Hide content and require PIN again
            binding.root.visibility = android.view.View.GONE
            isContentVisible = false
            showPinVerification()
        }
    }
    
    override fun onPause() {
        super.onPause()
        // Clear PIN verification when leaving the screen
        SharedPrefs.setPinVerified(this, false)
    }
    
    private fun setupViewPager() {
        val adapter = WalletPagerAdapter(this)
        binding.viewPager.adapter = adapter
        
        binding.tabLayout.visibility = android.view.View.GONE
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = if (position == 0) "Savings" else ""
        }.attach()
    }
}
