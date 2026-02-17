package com.dialadrink.driver.ui.admin

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.dialadrink.driver.R
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.*
import com.dialadrink.driver.databinding.ActivityLoansBinding
import com.dialadrink.driver.databinding.DialogAddLoanBinding
import com.dialadrink.driver.databinding.FragmentLoansTabBinding
import com.dialadrink.driver.databinding.ItemDriverLoanBinding
import com.dialadrink.driver.utils.SharedPrefs
import com.google.android.material.tabs.TabLayoutMediator
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class LoansActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoansBinding
    private val TAG = "LoansActivity"
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoansBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupToolbar()
        setupTabs()
    }
    
    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowHomeEnabled(true)
        supportActionBar?.title = "Loans & Penalties"
        
        binding.toolbar.setNavigationOnClickListener {
            finish()
        }
    }
    
    private fun setupTabs() {
        // Setup ViewPager2 with tabs
        val adapter = LoansPagerAdapter(this)
        binding.viewPager.adapter = adapter
        
        // Connect TabLayout with ViewPager2
        TabLayoutMediator(binding.tabLayout, binding.viewPager) { tab, position ->
            tab.text = when (position) {
                0 -> "Loans"
                1 -> "Penalties"
                else -> ""
            }
        }.attach()
    }
    
    // ViewPager2 adapter for tabs
    private class LoansPagerAdapter(fragmentActivity: FragmentActivity) : FragmentStateAdapter(fragmentActivity) {
        override fun getItemCount(): Int = 2
        
        override fun createFragment(position: Int): Fragment {
            return when (position) {
                0 -> LoansTabFragment()
                1 -> PenaltiesTabFragment()
                else -> LoansTabFragment()
            }
        }
    }
    
    // Loans Tab Fragment
    class LoansTabFragment : Fragment() {
        private var _binding: FragmentLoansTabBinding? = null
        private val binding get() = _binding!!
        private val driversWithLoans = mutableListOf<DriverWithLoanBalance>()
        private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        private val TAG = "LoansTabFragment"
        private var isLoading = false
        
        override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
            _binding = FragmentLoansTabBinding.inflate(inflater, container, false)
            return binding.root
        }
        
        override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
            super.onViewCreated(view, savedInstanceState)
            
            setupAddLoanButton()
            setupSwipeRefresh()
            loadDriversWithLoans()
        }
        
        private fun setupSwipeRefresh() {
            binding.swipeRefresh.setColorSchemeColors(requireContext().getColor(R.color.accent))
            binding.swipeRefresh.setOnRefreshListener {
                loadDriversWithLoans()
            }
        }
        
        private fun setupAddLoanButton() {
            binding.addLoanButton.setOnClickListener {
                showAddLoanDialog()
            }
        }
        
        private fun loadDriversWithLoans() {
            if (isLoading) return
            
            isLoading = true
            binding.loadingProgress.visibility = View.VISIBLE
            binding.emptyStateText.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            viewLifecycleOwner.lifecycleScope.launch {
                var drivers = emptyList<DriverWithLoanBalance>()
                try {
                    drivers = kotlinx.coroutines.withTimeoutOrNull(10000) {
                        if (!SharedPrefs.isAdminLoggedIn(requireContext())) {
                            Toast.makeText(requireContext(), "Please log in as admin", Toast.LENGTH_SHORT).show()
                            emptyList()
                        } else {
                            if (!ApiClient.isInitialized()) {
                                ApiClient.init(requireContext())
                            }
                            
                            val response = ApiClient.getApiService().getDriversWithLoanBalances()
                            
                            if (response.isSuccessful && response.body()?.success == true) {
                                response.body()!!.data ?: emptyList()
                            } else {
                                val errorBody = response.errorBody()?.string()
                                Log.e(TAG, "Failed to load loans. Code: ${response.code()}, Error: $errorBody")
                                emptyList()
                            }
                        }
                    } ?: emptyList()
                } catch (e: kotlinx.coroutines.CancellationException) {
                    // Ignore
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading drivers with loans: ${e.message}", e)
                    drivers = emptyList()
                } finally {
                    isLoading = false
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        driversWithLoans.clear()
                        driversWithLoans.addAll(drivers)
                        displayDrivers()
                    }
                }
            }
        }
        
        private fun displayDrivers() {
            binding.loadingProgress.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            // Clear existing views
            binding.driversContainer.removeAllViews()
            
            if (driversWithLoans.isEmpty()) {
                binding.emptyStateText.visibility = View.VISIBLE
                binding.emptyStateText.text = "No drivers with loans"
            } else {
                binding.emptyStateText.visibility = View.GONE
                driversWithLoans.forEach { driver ->
                    val card = createDriverCard(driver)
                    binding.driversContainer.addView(card)
                }
            }
        }
        
        private fun createDriverCard(driver: DriverWithLoanBalance): View {
            val cardBinding = com.dialadrink.driver.databinding.ItemPendingOrderBinding.inflate(
                LayoutInflater.from(requireContext()),
                binding.driversContainer,
                false
            )
            val card = cardBinding.root as com.google.android.material.card.MaterialCardView
            
            // Show driver name
            val driverName = driver.name ?: "Driver #${driver.id}"
            cardBinding.orderNumberText.text = driverName
            cardBinding.orderNumberText.gravity = android.view.Gravity.START
            
            // Show remaining loan amount
            cardBinding.customerNameLabel.visibility = View.VISIBLE
            cardBinding.customerNameLabel.text = "Remaining Loan:"
            cardBinding.customerNameText.visibility = View.VISIBLE
            cardBinding.customerNameText.text = currencyFormat.format(driver.loanBalance).replace("KES", "KES")
            cardBinding.customerNameText.setTypeface(null, android.graphics.Typeface.BOLD)
            
            // Hide all other elements
            cardBinding.locationLabel.visibility = View.GONE
            cardBinding.locationText.visibility = View.GONE
            cardBinding.driverLabel.visibility = View.GONE
            cardBinding.driverStatusText.visibility = View.GONE
            cardBinding.acceptButton.visibility = View.GONE
            cardBinding.rejectButton.visibility = View.GONE
            cardBinding.actionButtons.visibility = View.GONE
            
            // Make card clickable to view transactions
            card.setOnClickListener {
                val intent = Intent(requireContext(), DriverTransactionsActivity::class.java)
                intent.putExtra("driverId", driver.id)
                intent.putExtra("driverName", driverName)
                startActivity(intent)
            }
            
            return card
        }
        
        private fun removeDriverCards() {
            for (i in binding.driversContainer.childCount - 1 downTo 0) {
                val child = binding.driversContainer.getChildAt(i)
                if (child is com.google.android.material.card.MaterialCardView) {
                    binding.driversContainer.removeViewAt(i)
                }
            }
        }
        
        private fun showAddLoanDialog() {
            val dialogBinding = DialogAddLoanBinding.inflate(layoutInflater)
            val drivers = mutableListOf<Driver>()
            var selectedDriver: Driver? = null
            val driverLabels = mutableListOf<String>("Select Driver")
            
            // Load drivers
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    val response = ApiClient.getApiService().getDrivers()
                    if (response.isSuccessful && response.body() != null) {
                        val apiResponse = response.body()!!
                        // Handle both wrapped (ApiResponse) and raw array formats
                        val driversList: List<Driver> = when {
                            apiResponse.success == true && apiResponse.data != null -> apiResponse.data!!
                            apiResponse.data != null && apiResponse.data is List<*> -> {
                                @Suppress("UNCHECKED_CAST")
                                apiResponse.data as List<Driver>
                            }
                            else -> emptyList()
                        }
                        drivers.clear()
                        drivers.addAll(driversList)
                        driverLabels.clear()
                        driverLabels.add("Select Driver")
                        driverLabels.addAll(drivers.map { "${it.name} (${it.phoneNumber})" })
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading drivers: ${e.message}", e)
                }
            }
            
            dialogBinding.driverEditText.setOnClickListener {
                if (drivers.isEmpty()) {
                    Toast.makeText(requireContext(), "Loading drivers...", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                showDriverSelectionDialog(dialogBinding, drivers, driverLabels) { driver ->
                    selectedDriver = driver
                    if (driver != null) {
                        dialogBinding.driverEditText.setText("${driver.name} (${driver.phoneNumber})")
                    } else {
                        dialogBinding.driverEditText.setText("")
                    }
                }
            }
            
            val dialog = AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setView(dialogBinding.root)
                .setNegativeButton("Cancel", null)
                .create()
            
            dialogBinding.submitButton.setOnClickListener {
                val amountText = dialogBinding.amountEditText.text.toString().trim()
                val reason = dialogBinding.reasonEditText.text.toString().trim()
                
                if (selectedDriver == null) {
                    Toast.makeText(requireContext(), "Please select a driver", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                if (amountText.isEmpty()) {
                    Toast.makeText(requireContext(), "Please enter loan amount", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                val amount = amountText.toDoubleOrNull()
                if (amount == null || amount <= 0) {
                    Toast.makeText(requireContext(), "Please enter a valid loan amount", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                if (reason.isEmpty()) {
                    Toast.makeText(requireContext(), "Please enter a reason", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                createLoan(selectedDriver!!.id, amount, reason)
                dialog.dismiss()
            }
            
            dialog.show()
        }
        
        private fun showDriverSelectionDialog(
            dialogBinding: DialogAddLoanBinding,
            drivers: List<Driver>,
            driverLabels: List<String>,
            onDriverSelected: (Driver?) -> Unit
        ) {
            AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Select Driver")
                .setItems(driverLabels.toTypedArray()) { _, which ->
                    if (which == 0) {
                        onDriverSelected(null)
                        dialogBinding.driverEditText.setText("")
                    } else {
                        val driver = drivers[which - 1]
                        onDriverSelected(driver)
                    }
                }
                .show()
        }
        
        private fun createLoan(driverId: Int, amount: Double, reason: String) {
            binding.loadingProgress.visibility = View.VISIBLE
            
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    val request = CreateLoanRequest(driverId = driverId, amount = amount, reason = reason)
                    val response = ApiClient.getApiService().createLoan(request)
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        Toast.makeText(requireContext(), "Loan created successfully", Toast.LENGTH_SHORT).show()
                        // Add a small delay to ensure backend has processed the request
                        kotlinx.coroutines.delay(500)
                        // Reset isLoading flag to allow refresh
                        isLoading = false
                        loadDriversWithLoans() // Refresh the list
                    } else {
                        val errorBody = response.errorBody()?.string()
                        Log.e(TAG, "Failed to create loan. Code: ${response.code()}, Error: $errorBody")
                        Toast.makeText(requireContext(), "Failed to create loan", Toast.LENGTH_SHORT).show()
                        binding.loadingProgress.visibility = View.GONE
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error creating loan: ${e.message}", e)
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    binding.loadingProgress.visibility = View.GONE
                }
            }
        }
        
        override fun onDestroyView() {
            super.onDestroyView()
            _binding = null
        }
    }
    
    // Penalties Tab Fragment
    class PenaltiesTabFragment : Fragment() {
        private var _binding: FragmentLoansTabBinding? = null
        private val binding get() = _binding!!
        private val driversWithPenalties = mutableListOf<DriverWithPenaltyBalance>()
        private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("en", "KE"))
        private val TAG = "PenaltiesTabFragment"
        private var isLoading = false
        
        override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
            _binding = FragmentLoansTabBinding.inflate(inflater, container, false)
            return binding.root
        }
        
        override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
            super.onViewCreated(view, savedInstanceState)
            
            // Change Add Loan button to Add Penalty button for penalties tab
            binding.addLoanButton.text = "Add Penalty"
            binding.addLoanButton.setOnClickListener {
                showAddPenaltyDialog()
            }
            
            setupSwipeRefresh()
            loadDriversWithPenalties()
        }
        
        private fun setupSwipeRefresh() {
            binding.swipeRefresh.setColorSchemeColors(requireContext().getColor(R.color.accent))
            binding.swipeRefresh.setOnRefreshListener {
                loadDriversWithPenalties()
            }
        }
        
        private fun loadDriversWithPenalties() {
            if (isLoading) return
            
            isLoading = true
            binding.loadingProgress.visibility = View.VISIBLE
            binding.emptyStateText.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            viewLifecycleOwner.lifecycleScope.launch {
                var drivers = emptyList<DriverWithPenaltyBalance>()
                try {
                    drivers = kotlinx.coroutines.withTimeoutOrNull(10000) {
                        if (!SharedPrefs.isAdminLoggedIn(requireContext())) {
                            Toast.makeText(requireContext(), "Please log in as admin", Toast.LENGTH_SHORT).show()
                            emptyList()
                        } else {
                            if (!ApiClient.isInitialized()) {
                                ApiClient.init(requireContext())
                            }
                            
                            val response = ApiClient.getApiService().getDriversWithPenaltyBalances()
                            
                            if (response.isSuccessful && response.body()?.success == true) {
                                response.body()!!.data ?: emptyList()
                            } else {
                                val errorBody = response.errorBody()?.string()
                                Log.e(TAG, "Failed to load penalties. Code: ${response.code()}, Error: $errorBody")
                                emptyList()
                            }
                        }
                    } ?: emptyList()
                } catch (e: kotlinx.coroutines.CancellationException) {
                    // Ignore
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading drivers with penalties: ${e.message}", e)
                    drivers = emptyList()
                } finally {
                    isLoading = false
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        binding.loadingProgress.visibility = View.GONE
                        binding.swipeRefresh.isRefreshing = false
                        driversWithPenalties.clear()
                        driversWithPenalties.addAll(drivers)
                        displayDrivers()
                    }
                }
            }
        }
        
        private fun displayDrivers() {
            binding.loadingProgress.visibility = View.GONE
            binding.swipeRefresh.isRefreshing = false
            
            // Clear existing views
            binding.driversContainer.removeAllViews()
            
            if (driversWithPenalties.isEmpty()) {
                binding.emptyStateText.visibility = View.VISIBLE
                binding.emptyStateText.text = "No drivers with penalties"
            } else {
                binding.emptyStateText.visibility = View.GONE
                driversWithPenalties.forEach { driver ->
                    val card = createDriverCard(driver)
                    binding.driversContainer.addView(card)
                }
            }
        }
        
        private fun createDriverCard(driver: DriverWithPenaltyBalance): View {
            val cardBinding = com.dialadrink.driver.databinding.ItemPendingOrderBinding.inflate(
                LayoutInflater.from(requireContext()),
                binding.driversContainer,
                false
            )
            val card = cardBinding.root as com.google.android.material.card.MaterialCardView
            
            // Show driver name
            val driverName = driver.name ?: "Driver #${driver.id}"
            cardBinding.orderNumberText.text = driverName
            cardBinding.orderNumberText.gravity = android.view.Gravity.START
            
            // Show remaining penalty amount
            cardBinding.customerNameLabel.visibility = View.VISIBLE
            cardBinding.customerNameLabel.text = "Remaining Penalty:"
            cardBinding.customerNameText.visibility = View.VISIBLE
            cardBinding.customerNameText.text = currencyFormat.format(driver.penaltyBalance).replace("KES", "KES")
            cardBinding.customerNameText.setTypeface(null, android.graphics.Typeface.BOLD)
            
            // Hide all other elements
            cardBinding.locationLabel.visibility = View.GONE
            cardBinding.locationText.visibility = View.GONE
            cardBinding.driverLabel.visibility = View.GONE
            cardBinding.driverStatusText.visibility = View.GONE
            cardBinding.acceptButton.visibility = View.GONE
            cardBinding.rejectButton.visibility = View.GONE
            cardBinding.actionButtons.visibility = View.GONE
            
            // Make card clickable to view transactions
            card.setOnClickListener {
                val intent = Intent(requireContext(), DriverTransactionsActivity::class.java)
                intent.putExtra("driverId", driver.id)
                intent.putExtra("driverName", driverName)
                startActivity(intent)
            }
            
            return card
        }
        
        private fun removeDriverCards() {
            for (i in binding.driversContainer.childCount - 1 downTo 0) {
                val child = binding.driversContainer.getChildAt(i)
                if (child is com.google.android.material.card.MaterialCardView) {
                    binding.driversContainer.removeViewAt(i)
                }
            }
        }
        
        private fun showAddPenaltyDialog() {
            val dialogBinding = DialogAddLoanBinding.inflate(layoutInflater)
            val drivers = mutableListOf<Driver>()
            var selectedDriver: Driver? = null
            val driverLabels = mutableListOf<String>("Select Driver")
            
            // Load drivers
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    val response = ApiClient.getApiService().getDrivers()
                    if (response.isSuccessful && response.body() != null) {
                        val apiResponse = response.body()!!
                        // Handle both wrapped (ApiResponse) and raw array formats
                        val driversList: List<Driver> = when {
                            apiResponse.success == true && apiResponse.data != null -> apiResponse.data!!
                            apiResponse.data != null && apiResponse.data is List<*> -> {
                                @Suppress("UNCHECKED_CAST")
                                apiResponse.data as List<Driver>
                            }
                            else -> emptyList()
                        }
                        drivers.clear()
                        drivers.addAll(driversList)
                        driverLabels.clear()
                        driverLabels.add("Select Driver")
                        driverLabels.addAll(drivers.map { "${it.name} (${it.phoneNumber})" })
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error loading drivers: ${e.message}", e)
                }
            }
            
            dialogBinding.driverEditText.setOnClickListener {
                if (drivers.isEmpty()) {
                    Toast.makeText(requireContext(), "Loading drivers...", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                showDriverSelectionDialog(dialogBinding, drivers, driverLabels) { driver ->
                    selectedDriver = driver
                    if (driver != null) {
                        dialogBinding.driverEditText.setText("${driver.name} (${driver.phoneNumber})")
                    } else {
                        dialogBinding.driverEditText.setText("")
                    }
                }
            }
            
            val dialog = AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Add Penalty")
                .setView(dialogBinding.root)
                .setNegativeButton("Cancel", null)
                .create()
            
            dialogBinding.submitButton.setOnClickListener {
                val amountText = dialogBinding.amountEditText.text.toString().trim()
                val reason = dialogBinding.reasonEditText.text.toString().trim()
                
                if (selectedDriver == null) {
                    Toast.makeText(requireContext(), "Please select a driver", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                if (amountText.isEmpty()) {
                    Toast.makeText(requireContext(), "Please enter penalty amount", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                val amount = amountText.toDoubleOrNull()
                if (amount == null || amount <= 0) {
                    Toast.makeText(requireContext(), "Please enter a valid penalty amount", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                if (reason.isEmpty()) {
                    Toast.makeText(requireContext(), "Please enter a reason", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                
                createPenalty(selectedDriver!!.id, amount, reason)
                dialog.dismiss()
            }
            
            dialog.show()
        }
        
        private fun showDriverSelectionDialog(
            dialogBinding: DialogAddLoanBinding,
            drivers: List<Driver>,
            driverLabels: List<String>,
            onDriverSelected: (Driver?) -> Unit
        ) {
            AlertDialog.Builder(requireContext(), R.style.Theme_DialADrinkDriver_AlertDialog)
                .setTitle("Select Driver")
                .setItems(driverLabels.toTypedArray()) { _, which ->
                    if (which == 0) {
                        onDriverSelected(null)
                        dialogBinding.driverEditText.setText("")
                    } else {
                        val driver = drivers[which - 1]
                        onDriverSelected(driver)
                    }
                }
                .show()
        }
        
        private fun createPenalty(driverId: Int, amount: Double, reason: String) {
            binding.loadingProgress.visibility = View.VISIBLE
            
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    if (!ApiClient.isInitialized()) {
                        ApiClient.init(requireContext())
                    }
                    
                    // Use CreateLoanRequest with type parameter for penalties
                    val request = CreateLoanRequest(driverId = driverId, amount = amount, reason = reason, type = "penalty")
                    val response = ApiClient.getApiService().createLoan(request)
                    
                    if (response.isSuccessful && response.body()?.success == true) {
                        Toast.makeText(requireContext(), "Penalty created successfully", Toast.LENGTH_SHORT).show()
                        // Add a small delay to ensure backend has processed the request
                        kotlinx.coroutines.delay(500)
                        // Reset isLoading flag to allow refresh
                        isLoading = false
                        loadDriversWithPenalties() // Refresh the list
                    } else {
                        val errorBody = response.errorBody()?.string()
                        Log.e(TAG, "Failed to create penalty. Code: ${response.code()}, Error: $errorBody")
                        Toast.makeText(requireContext(), "Failed to create penalty", Toast.LENGTH_SHORT).show()
                        binding.loadingProgress.visibility = View.GONE
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Error creating penalty: ${e.message}", e)
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    binding.loadingProgress.visibility = View.GONE
                }
            }
        }
        
        override fun onDestroyView() {
            super.onDestroyView()
            _binding = null
        }
    }
}
