package com.dialadrink.driver

import android.app.Application
import android.util.Log
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.preloader.GlobalPreloader
import com.dialadrink.driver.utils.SharedPrefs

class DriverApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize API client
        ApiClient.init(this)
        
        // Preload critical data in background if user is already logged in (app restart scenario)
        // This is non-blocking - app renders immediately
        if (SharedPrefs.isLoggedIn(this)) {
            Log.d("DriverApplication", "🚀 User logged in, starting global preload (non-blocking)")
            GlobalPreloader.preloadCriticalData(this)
        }
    }
}

