package com.dialadrink.driver.ui.wallet

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter

class CashSubmissionsPagerAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
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
