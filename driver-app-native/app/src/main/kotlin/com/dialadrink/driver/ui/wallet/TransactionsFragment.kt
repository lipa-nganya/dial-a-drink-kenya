package com.dialadrink.driver.ui.wallet

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.dialadrink.driver.databinding.FragmentTransactionsBinding
import com.google.android.material.tabs.TabLayoutMediator

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
