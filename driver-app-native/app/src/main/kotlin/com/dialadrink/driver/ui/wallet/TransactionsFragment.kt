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
        
        // Main tabs: Logs, Submissions (with Pending / Approved / Rejected), Transactions (ledger)
        val mainPagerAdapter = MainTabsPagerAdapter(this)
        binding.mainViewPager.adapter = mainPagerAdapter

        TabLayoutMediator(binding.mainTabsLayout, binding.mainViewPager) { tab, position ->
            when (position) {
                0 -> tab.text = "Logs"
                1 -> tab.text = "Submissions"
                2 -> tab.text = "Transactions"
            }
        }.attach()

        // Default: open Logs tab
        binding.mainViewPager.setCurrentItem(0, false)

        // Load current cash at hand balance for header card
        loadCurrentCashAtHand()
    }

    private fun loadCurrentCashAtHand() {
        val driverId = SharedPrefs.getDriverId(requireContext()) ?: return
        lifecycleScope.launch {
            try {
                val response = ApiClient.getApiService().getCashAtHand(driverId)
                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    val actualCashAtHand = data?.totalCashAtHand ?: 0.0
                    val pendingSubmissionsTotal = data?.pendingSubmissionsTotal
                    val pendingCashAtHand = data?.pendingCashAtHand
                    val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE")).apply {
                        maximumFractionDigits = 0
                        minimumFractionDigits = 0
                    }
                    binding.currentCashAtHandText.text = currencyFormat.format(actualCashAtHand).replace("KES", "KES")

                    val hasPending = (pendingSubmissionsTotal != null && pendingSubmissionsTotal > 0.0009) || pendingCashAtHand != null
                    if (hasPending) {
                        val computedPending = pendingCashAtHand ?: (actualCashAtHand - (pendingSubmissionsTotal ?: 0.0))
                        binding.pendingCashAtHandSection.visibility = View.VISIBLE
                        binding.pendingCashAtHandText.text = currencyFormat.format(computedPending).replace("KES", "KES")
                    } else {
                        binding.pendingCashAtHandSection.visibility = View.GONE
                    }
                }
            } catch (_: Exception) {
                // ignore - keep last value
            }
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
                                (activity as? CashAtHandActivity)?.switchToMainTab(1) // Create Submission
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

    /**
     * Switch Cash at Hand inner main tab: 0=Logs, 1=Submissions, 2=Transactions (ledger).
     */
    fun switchToMainSubTab(position: Int) {
        if (_binding == null) return
        binding.mainViewPager.setCurrentItem(position, true)
        refresh()
    }
    
    fun refresh() {
        loadCurrentCashAtHand()
        // Refresh all child fragments
        try {
            val fragments = childFragmentManager.fragments
            fragments.forEach { fragment ->
                when (fragment) {
                    is CashTransactionsTabsFragment -> fragment.refresh()
                    is CashTransactionsFragment -> fragment.refresh()
                    is CashAtHandTransactionsFragment -> fragment.refresh()
                }
            }
        } catch (e: Exception) {
            // Ignore errors
        }
    }
    
    /**
     * Switch to Submissions tab and a status sub-tab.
     * @param position 0=Pending, 1=Approved, 2=Rejected
     */
    fun switchToTransactionsSubTab(position: Int) {
        binding.mainViewPager.setCurrentItem(1, true) // Submissions

        try {
            val transactionsTabsFragment =
                childFragmentManager.fragments.find { it is CashTransactionsTabsFragment } as? CashTransactionsTabsFragment
            transactionsTabsFragment?.switchToSubTab(position)
        } catch (_: Exception) {
            // Fragment not ready
        }
    }

    fun switchToTab(position: Int) {
        binding.mainViewPager.setCurrentItem(1, true)
        try {
            val transactionsTabsFragment =
                childFragmentManager.fragments.find { it is CashTransactionsTabsFragment } as? CashTransactionsTabsFragment
            transactionsTabsFragment?.switchToSubTab(position)
        } catch (_: Exception) {
        }
        refresh()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

/**
 * Main tabs: Logs, Submissions (nested Pending/Approved/Rejected), Transactions ledger.
 */
class MainTabsPagerAdapter(fragment: Fragment) : androidx.viewpager2.adapter.FragmentStateAdapter(fragment) {
    override fun getItemCount(): Int = 3

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> CashTransactionsFragment() // Logs
            1 -> CashTransactionsTabsFragment() // Submissions
            2 -> CashAtHandTransactionsFragment() // Transactions (cash at hand ledger)
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}

/** Submissions tab: Pending, Approved, Rejected. */
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
                0 -> tab.text = "Pending"
                1 -> tab.text = "Approved"
                2 -> tab.text = "Rejected"
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

/** Sub-tabs under Submissions: Pending, Approved, Rejected. */
class TransactionsSubTabsPagerAdapter(fragment: Fragment) : androidx.viewpager2.adapter.FragmentStateAdapter(fragment) {
    override fun getItemCount(): Int = 3

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> PendingSubmissionsFragment()
            1 -> ApprovedSubmissionsFragment()
            2 -> RejectedSubmissionsFragment()
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}
