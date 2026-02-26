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
        
        // Setup main tabs: Transactions and Logs
        val mainPagerAdapter = MainTabsPagerAdapter(this)
        binding.mainViewPager.adapter = mainPagerAdapter
        
        TabLayoutMediator(binding.mainTabsLayout, binding.mainViewPager) { tab, position ->
            when (position) {
                0 -> tab.text = "Transactions"
                1 -> tab.text = "Logs"
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
                        val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE")).apply {
                            maximumFractionDigits = 0
                            minimumFractionDigits = 0
                        }
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
                                (activity as? CashAtHandActivity)?.switchToMainTab(0)
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
                    is CashTransactionsTabsFragment -> fragment.refresh()
                    is CashTransactionsFragment -> fragment.refresh()
                }
            }
        } catch (e: Exception) {
            // Ignore errors
        }
    }
    
    /**
     * Switch to a specific sub-tab within Transactions tab
     * @param position 0=Pending, 1=Approved, 2=Rejected, 3=All
     */
    fun switchToTransactionsSubTab(position: Int) {
        // First switch to Transactions main tab
        binding.mainViewPager.setCurrentItem(0, true)
        
        // Then switch to the sub-tab
        try {
            val transactionsTabsFragment = childFragmentManager.fragments.find { it is CashTransactionsTabsFragment } as? CashTransactionsTabsFragment
            transactionsTabsFragment?.switchToSubTab(position)
        } catch (e: Exception) {
            // Fragment not found, ignore
        }
    }
    
    fun switchToTab(position: Int) {
        // Switch to Transactions tab (main tab 0)
        binding.mainViewPager.setCurrentItem(0, true)
        
        // Then switch to the sub-tab within Transactions
        try {
            val transactionsTabsFragment = childFragmentManager.fragments.find { it is CashTransactionsTabsFragment } as? CashTransactionsTabsFragment
            transactionsTabsFragment?.switchToSubTab(position)
        } catch (e: Exception) {
            // Fragment not found, ignore
        }
        
        // Refresh the tab after switching
        refresh()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

/**
 * Main tabs adapter: Transactions and Logs
 */
class MainTabsPagerAdapter(fragment: Fragment) : androidx.viewpager2.adapter.FragmentStateAdapter(fragment) {
    override fun getItemCount(): Int = 2
    
    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> CashTransactionsTabsFragment() // Transactions tab (with sub-tabs)
            1 -> CashTransactionsFragment() // Logs tab (shows all cash submissions)
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}

/**
 * Fragment for Transactions tab with sub-tabs: Pending, Approved, Rejected, All
 */
class CashTransactionsTabsFragment : Fragment() {
    private var _binding: com.dialadrink.driver.databinding.FragmentCashTransactionsTabsBinding? = null
    private val binding get() = _binding!!
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = com.dialadrink.driver.databinding.FragmentCashTransactionsTabsBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        val pagerAdapter = TransactionsSubTabsPagerAdapter(this)
        binding.transactionsViewPager.adapter = pagerAdapter
        
        TabLayoutMediator(binding.transactionsTabLayout, binding.transactionsViewPager) { tab, position ->
            when (position) {
                0 -> tab.text = "All"
                1 -> tab.text = "Pending"
                2 -> tab.text = "Approved"
                3 -> tab.text = "Rejected"
            }
        }.attach()
    }
    
    fun refresh() {
        // Refresh all child fragments
        try {
            val fragments = childFragmentManager.fragments
            fragments.forEach { fragment ->
                when (fragment) {
                    is CashAtHandTransactionsFragment -> fragment.refresh()
                    is PendingSubmissionsFragment -> fragment.refresh()
                    is ApprovedSubmissionsFragment -> fragment.refresh()
                    is RejectedSubmissionsFragment -> fragment.refresh()
                }
            }
        } catch (e: Exception) {
            // Ignore errors
        }
    }
    
    fun switchToSubTab(position: Int) {
        binding.transactionsViewPager.setCurrentItem(position, true)
        // Refresh the tab after switching
        refresh()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

/**
 * Sub-tabs adapter for Transactions tab: Pending, Approved, Rejected, All
 */
class TransactionsSubTabsPagerAdapter(fragment: Fragment) : androidx.viewpager2.adapter.FragmentStateAdapter(fragment) {
    override fun getItemCount(): Int = 4
    
    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> CashAtHandTransactionsFragment() // All transactions affecting cash at hand
            1 -> PendingSubmissionsFragment()
            2 -> ApprovedSubmissionsFragment()
            3 -> RejectedSubmissionsFragment()
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}
