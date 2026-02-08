package com.dialadrink.driver.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.findNavController
import androidx.navigation.ui.AppBarConfiguration
import androidx.navigation.ui.setupActionBarWithNavController
import androidx.navigation.ui.setupWithNavController
import com.dialadrink.driver.R
import com.dialadrink.driver.databinding.ActivityMainBinding
import com.dialadrink.driver.ui.auth.PhoneNumberActivity
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.bottomnavigation.BottomNavigationView

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        // Check if logged in (driver or admin)
        if (!SharedPrefs.isLoggedIn(this) && !SharedPrefs.isAdminLoggedIn(this)) {
            navigateToLogin()
            return
        }
        
        // If admin is logged in, navigate to admin dashboard
        if (SharedPrefs.isAdminLoggedIn(this)) {
            val intent = Intent(this, com.dialadrink.driver.ui.admin.AdminDashboardActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
            return
        }
        
        setupNavigation()
    }
    
    private fun setupNavigation() {
        val navController = findNavController(R.id.navHostFragment)
        val appBarConfiguration = AppBarConfiguration(
            setOf(
                R.id.nav_active_orders,
                R.id.nav_order_history,
                R.id.nav_wallet,
                R.id.nav_profile
            )
        )
        
        setupActionBarWithNavController(navController, appBarConfiguration)
        binding.bottomNavigation.setupWithNavController(navController)
    }
    
    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }
    
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.menu_logout -> {
                logout()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
    
    private fun logout() {
        SharedPrefs.clear(this)
        navigateToLogin()
    }
    
    private fun navigateToLogin() {
        val intent = Intent(this, PhoneNumberActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}


