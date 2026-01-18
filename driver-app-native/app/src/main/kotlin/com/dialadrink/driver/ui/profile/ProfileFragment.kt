package com.dialadrink.driver.ui.profile

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.FragmentProfileBinding
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.ui.main.MainActivity
import com.dialadrink.driver.utils.SharedPrefs

class ProfileFragment : Fragment() {
    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        loadProfileData()
        setupButtons()
    }
    
    private fun loadProfileData() {
        val name = SharedPrefs.getDriverName(requireContext())
        val phone = SharedPrefs.getDriverPhone(requireContext())
        
        binding.nameText.text = name ?: "Driver"
        binding.phoneText.text = phone ?: "N/A"
        binding.appVersionText.text = "Version 1.0.0"
    }
    
    private fun setupButtons() {
        binding.logoutButton.setOnClickListener {
            logout()
        }
        
        // Terms of Use toggle
        binding.termsOfUseText.setOnClickListener {
            val isVisible = binding.termsOfUseContent.visibility == View.VISIBLE
            binding.termsOfUseContent.visibility = if (isVisible) View.GONE else View.VISIBLE
        }
        
        // Privacy Policy toggle
        binding.privacyPolicyText.setOnClickListener {
            val isVisible = binding.privacyPolicyContent.visibility == View.VISIBLE
            binding.privacyPolicyContent.visibility = if (isVisible) View.GONE else View.VISIBLE
        }
        
        // Developed by Wolfgang link
        binding.developedByText.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://thewolfgang.tech"))
            startActivity(intent)
        }
    }
    
    private fun logout() {
        SharedPrefs.clear(requireContext())
        val intent = Intent(requireContext(), PhoneNumberActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        requireActivity().finish()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}


