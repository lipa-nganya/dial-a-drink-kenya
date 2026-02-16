package com.dialadrink.driver.ui.admin

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityAdminSettingsBinding
import kotlinx.coroutines.launch

class AdminSettingsActivity : AppCompatActivity() {
    private lateinit var binding: ActivityAdminSettingsBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAdminSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        loadSettings()
        setupSaveButton()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun loadSettings() {
        // TODO: Loan deduction settings endpoints not available
        // Settings loading disabled
        binding.deductionFrequencyEditText.setText("")
        binding.deductionAmountEditText.setText("")
    }
    
    private fun setupSaveButton() {
        binding.saveSettingsButton.setOnClickListener {
            saveSettings()
        }
    }
    
    private fun saveSettings() {
        val frequencyText = binding.deductionFrequencyEditText.text?.toString() ?: ""
        val amountText = binding.deductionAmountEditText.text?.toString() ?: ""
        
        val frequency = frequencyText.toIntOrNull()
        val amount = amountText.toDoubleOrNull()
        
        if (frequency == null || frequency <= 0) {
            Toast.makeText(this, "Please enter a valid deduction frequency (hours)", Toast.LENGTH_SHORT).show()
            return
        }
        
        if (amount == null || amount <= 0) {
            Toast.makeText(this, "Please enter a valid deduction amount (KES)", Toast.LENGTH_SHORT).show()
            return
        }
        
        // TODO: Loan deduction settings endpoints not available
        Toast.makeText(this, "Settings save feature is not available", Toast.LENGTH_SHORT).show()
    }
}
