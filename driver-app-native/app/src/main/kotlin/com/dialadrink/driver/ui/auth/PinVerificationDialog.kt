package com.dialadrink.driver.ui.auth

import android.app.Dialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.VerifyPinRequest
import com.dialadrink.driver.databinding.DialogPinVerificationBinding
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.launch

class PinVerificationDialog : DialogFragment() {
    private var _binding: DialogPinVerificationBinding? = null
    private val binding get() = _binding!!
    
    private var onVerified: (() -> Unit)? = null
    private var onCancelled: (() -> Unit)? = null
    
    fun setOnVerifiedListener(listener: () -> Unit) {
        onVerified = listener
    }
    
    fun setOnCancelledListener(listener: () -> Unit) {
        onCancelled = listener
    }
    
    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        return super.onCreateDialog(savedInstanceState).apply {
            window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
        }
    }
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogPinVerificationBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        
        dialog?.setCancelable(false)
        dialog?.setCanceledOnTouchOutside(false)
        
        setupViews()
    }
    
    private fun setupViews() {
        // Format PIN input to show only numbers, max 4 digits
        binding.pinEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val text = s.toString().replace(Regex("[^0-9]"), "")
                if (text != s.toString()) {
                    binding.pinEditText.setText(text)
                    binding.pinEditText.setSelection(text.length)
                }
                
                // Auto-submit when 4 digits entered
                if (text.length == 4) {
                    verifyPin(text)
                }
            }
        })
        
        binding.verifyButton.setOnClickListener {
            val pin = binding.pinEditText.text.toString().trim()
            if (pin.length == 4) {
                verifyPin(pin)
            } else {
                showError("Please enter your 4-digit PIN")
            }
        }
        
        binding.cancelButton.setOnClickListener {
            onCancelled?.invoke()
            dismiss()
        }
        
        // Auto-focus PIN input
        binding.pinEditText.requestFocus()
    }
    
    private fun verifyPin(pin: String) {
        val phone = SharedPrefs.getDriverPhone(requireContext()) ?: ""
        if (phone.isEmpty()) {
            showError("Phone number not found")
            return
        }
        
        // Clean phone number (remove non-digits) to ensure consistent format
        val cleanedPhone = phone.replace(Regex("[^0-9]"), "")
        android.util.Log.d("PinVerificationDialog", "🔐 Verifying PIN for phone: $cleanedPhone")
        
        binding.loadingProgress.visibility = View.VISIBLE
        binding.verifyButton.isEnabled = false
        binding.errorText.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().verifyPin(
                    cleanedPhone,
                    VerifyPinRequest(pin)
                )
                
                android.util.Log.d("PinVerificationDialog", "📡 PIN verification response - Success: ${response.isSuccessful}, Code: ${response.code()}")
                
                if (response.isSuccessful && response.body()?.success == true) {
                    android.util.Log.d("PinVerificationDialog", "✅ PIN verified successfully")
                    // Mark PIN as verified for this session
                    SharedPrefs.setPinVerified(requireContext(), true)
                    
                    // Call success callback
                    onVerified?.invoke()
                    dismiss()
                } else {
                    val errorMsg = response.body()?.error ?: "Invalid PIN"
                    android.util.Log.e("PinVerificationDialog", "❌ PIN verification failed: $errorMsg")
                    showError(errorMsg)
                    binding.pinEditText.text?.clear()
                    binding.pinEditText.requestFocus()
                }
            } catch (e: Exception) {
                showError("Network error: ${e.message}")
                binding.pinEditText.text?.clear()
                binding.pinEditText.requestFocus()
            } finally {
                binding.loadingProgress.visibility = View.GONE
                binding.verifyButton.isEnabled = true
            }
        }
    }
    
    private fun showError(message: String) {
        binding.errorText.text = message
        binding.errorText.visibility = View.VISIBLE
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
