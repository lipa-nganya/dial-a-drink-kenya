package com.dialadrink.driver.data.preloader

import android.content.Context
import android.util.Log
import com.dialadrink.driver.data.repository.OrderRepository
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Global Background Preloader
 * 
 * Rules:
 * - Runs after app launch (non-blocking)
 * - Fetches only active/critical data
 * - Small payload endpoints only
 * - Never blocks navigation or rendering
 * - All screens use cached data from this preloader
 */
object GlobalPreloader {
    private const val TAG = "GlobalPreloader"
    private val preloadScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var hasPreloaded = false
    
    /**
     * Preload critical data after app launch
     * Call this from Application.onCreate() or DashboardActivity.onCreate()
     */
    fun preloadCriticalData(context: Context) {
        if (hasPreloaded) {
            Log.d(TAG, "⏸️ Already preloaded, skipping")
            return
        }
        
        val driverId = SharedPrefs.getDriverId(context) ?: run {
            Log.d(TAG, "⚠️ No driver ID, skipping preload")
            return
        }
        
        Log.d(TAG, "🚀 Starting global preload for driver: $driverId")
        hasPreloaded = true
        
        preloadScope.launch {
            try {
                // Preload active orders (most critical)
                Log.d(TAG, "📦 Preloading active orders...")
                OrderRepository.prefetchActiveOrders(context)
                
                Log.d(TAG, "✅ Global preload completed")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error in global preload", e)
            }
        }
    }
    
    /**
     * Reset preload flag (for testing or logout)
     */
    fun reset() {
        hasPreloaded = false
    }
}


