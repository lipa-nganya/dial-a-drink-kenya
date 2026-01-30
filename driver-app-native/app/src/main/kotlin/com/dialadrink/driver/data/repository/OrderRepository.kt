package com.dialadrink.driver.data.repository

import android.content.Context
import android.util.Log
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.Order
import com.dialadrink.driver.utils.OrderCache
import com.dialadrink.driver.utils.SharedPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap

/**
 * Centralized Order Repository - Single Source of Truth
 * 
 * Rules:
 * - All screens must use this repository, never call API directly
 * - Returns cached data immediately if available
 * - Fetches in background only if cache is stale or missing
 * - Deduplicates concurrent requests to the same endpoint
 * - Caches all responses (memory + disk)
 */
object OrderRepository {
    private const val TAG = "OrderRepository"
    private const val CACHE_STALE_TIME_MS = 30_000 // 30 seconds
    
    // In-flight requests tracking (request deduplication)
    private val inFlightRequests = ConcurrentHashMap<String, Deferred<List<Order>>>()
    private val requestMutex = Mutex()
    private val repositoryScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // State flow for reactive updates
    private val _activeOrders = MutableStateFlow<List<Order>>(emptyList())
    val activeOrders: Flow<List<Order>> = _activeOrders.asStateFlow()
    
    /**
     * Get active orders (cached first, then fetch if needed)
     * This is the ONLY way screens should get orders
     */
    suspend fun getActiveOrders(
        context: Context,
        forceRefresh: Boolean = false
    ): List<Order> {
        // Return cached data immediately if available
        if (!forceRefresh) {
            val cached = OrderCache.getCachedOrders()
            if (cached != null) {
                val active = cached.filter { 
                    it.driverAccepted == true && 
                    it.status != "completed" && 
                    it.status != "cancelled" 
                }
                if (active.isNotEmpty()) {
                    return active
                }
            }
        }
        
        // Use the SAME working endpoint as pending orders - call it directly
        val driverId = SharedPrefs.getDriverId(context) ?: return emptyList()
        
        return try {
            ensureApiClientInitialized(context)
            
            val activeStatuses = "pending,confirmed,preparing,out_for_delivery"
            val response = ApiClient.getApiService().getDriverOrdersDirect(
                driverId,
                activeStatuses,
                summary = true
            )
            
            if (!response.isSuccessful || response.body() == null) {
                return emptyList()
            }
            
            val apiResponse = response.body()!!
            if (apiResponse.success != true || apiResponse.data == null) {
                return emptyList()
            }
            
            val allOrders = apiResponse.data
            
            // Cache all orders
            OrderCache.setCachedOrders(allOrders)
            SharedPrefs.saveCachedOrders(context, allOrders)
            
            // Filter for active orders: driverAccepted == true and not completed/cancelled
            val activeOrders = allOrders.filter { 
                it.driverAccepted == true && 
                it.status != "completed" && 
                it.status != "cancelled"
            }
            
            // Update state flow with filtered active orders
            _activeOrders.value = activeOrders
            
            activeOrders
        } catch (e: Exception) {
            emptyList()
        }
    }
    
    /**
     * Refresh active orders (force fetch)
     * Bypasses cache and mutex to avoid hanging
     */
    suspend fun refreshActiveOrders(context: Context): List<Order> {
        val driverId = SharedPrefs.getDriverId(context) ?: return emptyList()
        
        return try {
            ensureApiClientInitialized(context)
            
            val activeStatuses = "pending,confirmed,preparing,out_for_delivery"
            val response = ApiClient.getApiService().getDriverOrdersDirect(
                driverId,
                activeStatuses,
                summary = true
            )
            
            if (!response.isSuccessful || response.body() == null) {
                return emptyList()
            }
            
            val apiResponse = response.body()!!
            if (apiResponse.success != true || apiResponse.data == null) {
                return emptyList()
            }
            
            val allOrders = apiResponse.data
            
            // Filter for active orders: driverAccepted == true and not completed/cancelled
            val activeOrders = allOrders.filter { 
                it.driverAccepted == true && 
                it.status != "completed" && 
                it.status != "cancelled"
            }
            
            // Cache all orders in memory and disk (for pending orders to use)
            OrderCache.setCachedOrders(allOrders)
            SharedPrefs.saveCachedOrders(context, allOrders)
            
            // Update state flow with filtered active orders
            _activeOrders.value = activeOrders
            
            activeOrders
        } catch (e: Exception) {
            emptyList()
        }
    }
    
    /**
     * Prefetch active orders in background (non-blocking)
     */
    fun prefetchActiveOrders(context: Context) {
        repositoryScope.launch {
            try {
                getActiveOrders(context, forceRefresh = false)
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error prefetching orders", e)
            }
        }
    }
    
    /**
     * Get pending orders (assigned to driver but not yet accepted/rejected)
     * Uses the dedicated pending orders endpoint
     */
    suspend fun getPendingOrders(
        context: Context,
        forceRefresh: Boolean = false
    ): List<Order> {
        // If forceRefresh is true, clear cache first
        if (forceRefresh) {
            OrderCache.clear()
            SharedPrefs.clearCachedOrders(context)
        }
        
        // Return cached data immediately if available (only if not forcing refresh)
        if (!forceRefresh) {
            val cached = OrderCache.getCachedOrders()
            if (cached != null) {
                val pending = cached.filter { 
                    it.driverId != null && 
                    (it.driverAccepted == null || it.driverAccepted == false) &&
                    (it.status == "pending" || it.status == "confirmed")
                }
                if (pending.isNotEmpty()) {
                    return pending
                }
            }
        }
        
        // Use the dedicated pending orders endpoint
        val driverId = SharedPrefs.getDriverId(context) ?: return emptyList()
        
        return try {
            ensureApiClientInitialized(context)
            
            // Use the dedicated pending orders endpoint (not the active orders endpoint)
            val response = ApiClient.getApiService().getPendingOrders(
                driverId,
                summary = true
            )
            
            if (!response.isSuccessful || response.body() == null) {
                Log.w(TAG, "❌ Failed to fetch pending orders: ${response.code()}")
                return emptyList()
            }
            
            val apiResponse = response.body()!!
            if (apiResponse.success != true || apiResponse.data == null) {
                Log.w(TAG, "❌ Pending orders API returned error: ${apiResponse.error}")
                return emptyList()
            }
            
            val pendingOrders = apiResponse.data
            
            // Update cache with pending orders only (don't fetch all orders here to avoid delays)
            // The active orders screen will fetch its own data when needed
            val cached = OrderCache.getCachedOrders() ?: emptyList()
            // Remove old pending orders from cache and add new ones
            val nonPendingOrders = cached.filter { 
                !(it.driverId != null && 
                  (it.driverAccepted == null || it.driverAccepted == false) &&
                  (it.status == "pending" || it.status == "confirmed"))
            }
            val mergedOrders = (nonPendingOrders + pendingOrders).distinctBy { it.id }
            OrderCache.setCachedOrders(mergedOrders)
            SharedPrefs.saveCachedOrders(context, mergedOrders)
            
            Log.d(TAG, "✅ Fetched ${pendingOrders.size} pending orders for driver $driverId")
            pendingOrders
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error fetching pending orders", e)
            emptyList()
        }
    }
    
    /**
     * Respond to order (accept or reject)
     * @return Pair<Boolean, String?> where Boolean is success status and String is error message if failed
     */
    suspend fun respondToOrder(
        context: Context,
        orderId: Int,
        accepted: Boolean
    ): Pair<Boolean, String?> {
        return try {
            val driverId = SharedPrefs.getDriverId(context) ?: return Pair(false, "No driver ID found. Please log in again.")
            ensureApiClientInitialized(context)
            
            val request = com.dialadrink.driver.data.model.RespondToOrderRequest(
                driverId = driverId,
                accepted = accepted
            )
            
            val response = ApiClient.getApiService().respondToOrder(orderId, request)
            
            if (!response.isSuccessful || response.body() == null) {
                val responseCode: Int = response.code()
                val errorBody = response.errorBody()?.string() ?: ""
                val errorMessage = try {
                    if (errorBody.isNotBlank() && !errorBody.trim().startsWith("<")) {
                        val json = org.json.JSONObject(errorBody)
                        json.optString("error", json.optString("message", "Unknown error"))
                    } else {
                        "Network error (${responseCode})"
                    }
                } catch (e: Exception) {
                    "Network error (${responseCode})"
                }
                return Pair(false, errorMessage)
            }
            
            // Backend returns WRAPPED response: { success: true, data: {...} }
            val apiResponse = response.body()!!
            if (apiResponse.success != true) {
                return Pair(false, apiResponse.error ?: "Unknown error")
            }
            
            // Success - clear cache aggressively and refresh
            clearCache(context)
            // Refresh active orders in background after accepting
            if (accepted) {
                repositoryScope.launch {
                    try {
                        // Wait a bit for backend to update
                        delay(500)
                        refreshActiveOrders(context)
                        // Refresh again after another delay to catch eventual consistency
                        delay(2000)
                        refreshActiveOrders(context)
                    } catch (e: Exception) {
                        // Ignore errors in background refresh
                    }
                }
            }
            return Pair(true, null)
        } catch (e: java.net.UnknownHostException) {
            return Pair(false, "Cannot connect to server")
        } catch (e: java.net.SocketTimeoutException) {
            return Pair(false, "Request timed out")
        } catch (e: java.io.IOException) {
            return Pair(false, "Network error")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Unexpected error responding to order", e)
            return Pair(false, "Unexpected error: ${e.message}")
        }
    }
    
    /**
     * Get completed orders with optional date filtering
     * By default returns last 10 completed orders
     */
    suspend fun getCompletedOrders(
        context: Context,
        fromDate: java.util.Date? = null,
        toDate: java.util.Date? = null,
        limit: Int = 10
    ): List<Order> {
        val driverId = SharedPrefs.getDriverId(context) ?: return emptyList()

        return try {
            ensureApiClientInitialized(context)

            val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            val startDateStr = fromDate?.let { dateFormat.format(it) }
            val endDateStr = toDate?.let { dateFormat.format(it) }

            val response = ApiClient.getApiService().getCompletedOrdersWithDates(
                driverId,
                status = "completed",
                startDate = startDateStr,
                endDate = endDateStr,
                summary = true
            )

            if (!response.isSuccessful || response.body() == null) {
                return emptyList()
            }

            val apiResponse = response.body()!!
            if (apiResponse.success != true || apiResponse.data == null) {
                return emptyList()
            }

            var orders = apiResponse.data

            // Sort by date descending (most recent first)
            orders = orders.sortedByDescending { 
                it.createdAt ?: ""
            }

            // If no date filter, limit to last 10
            if (fromDate == null && toDate == null) {
                orders = orders.take(limit)
            }

            orders
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Get cancelled orders with optional date filtering
     * By default returns last 10 cancelled orders assigned to the driver
     */
    suspend fun getCancelledOrders(
        context: Context,
        fromDate: java.util.Date? = null,
        toDate: java.util.Date? = null,
        limit: Int = 10
    ): List<Order> {
        val driverId = SharedPrefs.getDriverId(context) ?: return emptyList()

        return try {
            ensureApiClientInitialized(context)

            val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
            val startDateStr = fromDate?.let { dateFormat.format(it) }
            val endDateStr = toDate?.let { dateFormat.format(it) }

            val response = ApiClient.getApiService().getCompletedOrdersWithDates(
                driverId,
                status = "cancelled",
                startDate = startDateStr,
                endDate = endDateStr,
                summary = true
            )

            if (!response.isSuccessful || response.body() == null) {
                return emptyList()
            }

            val apiResponse = response.body()!!
            if (apiResponse.success != true || apiResponse.data == null) {
                return emptyList()
            }

            var orders = apiResponse.data

            // Filter for orders assigned to this driver (driverId matches)
            orders = orders.filter { it.driverId == driverId }

            // Sort by date descending (most recent first)
            orders = orders.sortedByDescending { 
                it.createdAt ?: ""
            }

            // If no date filter, limit to last 10
            if (fromDate == null && toDate == null) {
                orders = orders.take(limit)
            }

            orders
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Clear all caches
     */
    suspend fun clearCache(context: Context) {
        OrderCache.clear()
        SharedPrefs.clearCachedOrders(context)
        _activeOrders.value = emptyList()
        Log.d(TAG, "🗑️ Cache cleared")
    }
    
    private fun ensureApiClientInitialized(context: Context) {
        if (!ApiClient.isInitialized()) {
            ApiClient.init(context)
        }
    }
    
    private fun estimatePayloadSize(orders: List<Order>): String {
        // Rough estimate: each order ~500 bytes in summary mode
        val sizeKB = (orders.size * 500) / 1024.0
        return String.format("%.2f", sizeKB)
    }
}

