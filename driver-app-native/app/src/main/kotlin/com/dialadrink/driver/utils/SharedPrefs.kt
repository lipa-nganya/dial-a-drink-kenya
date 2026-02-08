package com.dialadrink.driver.utils

import android.content.Context
import android.content.SharedPreferences
import com.dialadrink.driver.data.model.Order
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object SharedPrefs {
    private const val PREFS_NAME = "driver_prefs"
    private const val KEY_CACHED_ORDERS = "cached_active_orders"
    private val gson = Gson()
    
    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    // Driver info
    fun saveDriverPhone(context: Context, phone: String) {
        getPrefs(context).edit().putString("driver_phone", phone).apply()
    }
    
    fun getDriverPhone(context: Context): String? {
        return getPrefs(context).getString("driver_phone", null)
    }
    
    fun saveDriverId(context: Context, driverId: Int) {
        getPrefs(context).edit().putInt("driver_id", driverId).apply()
    }
    
    fun getDriverId(context: Context): Int? {
        val id = getPrefs(context).getInt("driver_id", -1)
        return if (id == -1) null else id
    }
    
    fun saveDriverName(context: Context, name: String) {
        getPrefs(context).edit().putString("driver_name", name).apply()
    }
    
    fun getDriverName(context: Context): String? {
        return getPrefs(context).getString("driver_name", null)
    }
    
    fun setLoggedIn(context: Context, loggedIn: Boolean) {
        getPrefs(context).edit().putBoolean("driver_logged_in", loggedIn).apply()
    }
    
    fun isLoggedIn(context: Context): Boolean {
        return getPrefs(context).getBoolean("driver_logged_in", false)
    }
    
    fun clear(context: Context) {
        getPrefs(context).edit().clear().apply()
    }
    
    // Admin info
    fun saveAdminToken(context: Context, token: String) {
        getPrefs(context).edit().putString("admin_token", token).apply()
    }
    
    fun getAdminToken(context: Context): String? {
        return getPrefs(context).getString("admin_token", null)
    }
    
    fun clearAdminToken(context: Context) {
        getPrefs(context).edit().remove("admin_token").apply()
    }
    
    // OTA Update tracking
    fun getOtaCount(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt("ota_update_count", 0)
    }
    
    fun setOtaCount(context: Context, count: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putInt("ota_update_count", count).apply()
    }
    
    // App branch/channel tracking
    fun getAppBranch(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("app_branch", null)
    }
    
    fun setAppBranch(context: Context, branch: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString("app_branch", branch).apply()
    }
    
    fun getAppChannel(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString("app_channel", null)
    }
    
    fun setAppChannel(context: Context, channel: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString("app_channel", channel).apply()
    }
    
    // Cached orders for instant loading
    fun saveCachedOrders(context: Context, orders: List<Order>) {
        val prefs = getPrefs(context)
        val json = gson.toJson(orders)
        prefs.edit().putString(KEY_CACHED_ORDERS, json).apply()
    }
    
    fun getCachedOrders(context: Context): List<Order> {
        val prefs = getPrefs(context)
        val json = prefs.getString(KEY_CACHED_ORDERS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<Order>>() {}.type
            gson.fromJson<List<Order>>(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
    
    fun clearCachedOrders(context: Context) {
        val prefs = getPrefs(context)
        prefs.edit().remove(KEY_CACHED_ORDERS).apply()
    }
    
    // PIN Verification (session-based, expires after 5 minutes)
    fun setPinVerified(context: Context, verified: Boolean) {
        val prefs = getPrefs(context)
        val editor = prefs.edit()
        editor.putBoolean("pin_verified", verified)
        if (verified) {
            // Store timestamp when PIN was verified (5 minutes = 300000 ms)
            editor.putLong("pin_verified_timestamp", System.currentTimeMillis())
        } else {
            editor.remove("pin_verified_timestamp")
        }
        editor.apply()
    }
    
    fun isPinVerified(context: Context): Boolean {
        val prefs = getPrefs(context)
        val verified = prefs.getBoolean("pin_verified", false)
        if (!verified) return false
        
        // Check if verification is still valid (within 5 minutes)
        val timestamp = prefs.getLong("pin_verified_timestamp", 0)
        val currentTime = System.currentTimeMillis()
        val fiveMinutes = 5 * 60 * 1000L // 5 minutes in milliseconds
        
        return (currentTime - timestamp) < fiveMinutes
    }
    
    // Admin info
    fun saveAdminPhone(context: Context, phone: String) {
        getPrefs(context).edit().putString("admin_phone", phone).apply()
    }
    
    fun getAdminPhone(context: Context): String? {
        return getPrefs(context).getString("admin_phone", null)
    }
    
    fun saveAdminId(context: Context, adminId: Int) {
        getPrefs(context).edit().putInt("admin_id", adminId).apply()
    }
    
    fun getAdminId(context: Context): Int? {
        val id = getPrefs(context).getInt("admin_id", -1)
        return if (id == -1) null else id
    }
    
    fun saveAdminUsername(context: Context, username: String) {
        getPrefs(context).edit().putString("admin_username", username).apply()
    }
    
    fun getAdminUsername(context: Context): String? {
        return getPrefs(context).getString("admin_username", null)
    }
    
    fun setAdminLoggedIn(context: Context, loggedIn: Boolean) {
        getPrefs(context).edit().putBoolean("admin_logged_in", loggedIn).apply()
    }
    
    fun isAdminLoggedIn(context: Context): Boolean {
        return getPrefs(context).getBoolean("admin_logged_in", false)
    }
    
    fun getUserType(context: Context): String {
        return when {
            isAdminLoggedIn(context) -> "admin"
            isLoggedIn(context) -> "driver"
            else -> "none"
        }
    }
}

