package com.dialadrink.driver.ui.wallet

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter

class WalletPagerAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
    override fun getItemCount(): Int = 2
    
    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> WalletFragment()
            1 -> SavingsFragment()
            else -> throw IllegalArgumentException("Invalid position: $position")
        }
    }
}
