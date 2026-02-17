package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.databinding.FragmentTransactionsBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.*

class TransactionsFragment : Fragment() {
    private var _binding: FragmentTransactionsBinding? = null
    private val binding get() = _binding!!
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTransactionsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val pagerAdapter = TransactionsPagerAdapter(this)
        binding.transactionsViewPager.adapter = pagerAdapter
        
        TabLayoutMediator(binding.transactionsTabLayout, binding.transactionsViewPager) { tab, position ->
            when (position) {
                0 -> tab.text = "All"
                1 -> tab.text = "Pending"
                2 -> tab.text = "Approved"
                3 -> tab.text = "Rejected"
            }
        }.attach()
        
        // Setup cash at hand summary button
        binding.cashAtHandSummaryButton.setOnClickListener {
            showCashAtHandSummary()
        }
    }
    
    private fun showCashAtHandSummary() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCashAtHand(driverId)
                
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null) {
                        val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
                        val actualCashAtHand = data.totalCashAtHand ?: 0.0
                        val pendingCashAtHand = data.pendingCashAtHand ?: 0.0
                        val balance = actualCashAtHand + pendingCashAtHand
                        
                        val message = """
                            Actual Cash At Hand: ${currencyFormat.format(actualCashAtHand)}
                            
                            Submissions Pending Approval: ${currencyFormat.format(pendingCashAtHand)}
                            
                            Balance (if pending approved): ${currencyFormat.format(balance)}
                        """.trimIndent()
                        
                        MaterialAlertDialogBuilder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                            .setTitle("Cash At Hand Summary")
                            .setMessage(message)
                            .setPositiveButton("Submit Pending Cash At Hand") { _, _ ->
                                // Navigate to Cash At Hand form tab
                                (activity as? CashAtHandActivity)?.let { activity ->
                                    activity.binding.mainViewPager.setCurrentItem(0, true)
                                }
                            }
                            .setNegativeButton("Close", null)
                            .show()
                    } else {
                        Toast.makeText(requireContext(), "Failed to load cash at hand data", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(requireContext(), "Failed to load cash at hand data", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    fun refresh() {
        // Refresh all child fragments
        try {
            val fragments = childFragmentManager.fragments
            fragments.forEach { fragment ->
                when (fragment) {
                    is CashTransactionsFragment -> fragment.refresh()
                    is PendingSubmissionsFragment -> fragment.refresh()
                    is ApprovedSubmissionsFragment -> fragment.refresh()
                    is RejectedSubmissionsFragment -> fragment.refresh()
                }
            }
        } catch (e: Exception) {
            // Ignore errors
        }
    }
    
    fun switchToTab(position: Int) {
        binding.transactionsViewPager.setCurrentItem(position, true)
        // Refresh the tab after switching
        refresh()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

class TransactionsPagerAdapter(fragment: Fragment) : androidx.viewpager2.adapter.FragmentStateAdapter(fragment) {
    override fun getItemCount(): Int = 4
    
    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> CashTransactionsFragment()
            1 -> PendingSubmissionsFragment()
            2 -> ApprovedSubmissionsFragment()
            3 -> RejectedSubmissionsFragment()
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}
