package com.dialadrink.driver.data.api

import android.content.Context
import com.dialadrink.driver.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import com.dialadrink.driver.data.api.UnwrappingJsonConverterFactory
import com.google.gson.GsonBuilder
import java.util.concurrent.TimeUnit

object ApiClient {
    private var retrofit: Retrofit? = null
    private val baseUrl = BuildConfig.API_BASE_URL
    
    // Single Gson instance app-wide
    val gson: com.google.gson.Gson = GsonBuilder()
        .setLenient()
        .create()
    
    fun isInitialized(): Boolean {
        return retrofit != null
    }
    
    
    fun init(context: Context) {
        android.util.Log.e("ApiClient", "═══════════════════════════════════════════════════════")
        android.util.Log.e("ApiClient", "🔧 INITIALIZING API CLIENT")
        android.util.Log.e("ApiClient", "🔧 BuildConfig.API_BASE_URL: $baseUrl")
        android.util.Log.e("ApiClient", "🔧 BuildConfig.BUILD_TYPE: ${BuildConfig.BUILD_TYPE}")
        android.util.Log.e("ApiClient", "🔧 Full API base URL will be: $baseUrl/api/")
        android.util.Log.e("ApiClient", "═══════════════════════════════════════════════════════")
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.HEADERS // Changed from BODY to avoid consuming response body
        }
        
        val client = OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .addInterceptor { chain ->
                val requestBuilder = chain.request().newBuilder()
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Accept", "application/json")
                    .addHeader("Accept-Encoding", "gzip, deflate")
                    .addHeader("ngrok-skip-browser-warning", "true")
                    .addHeader("User-Agent", "DialADrink-Driver-Android")
                
                // Add admin token if available (for admin API calls)
                val adminToken = com.dialadrink.driver.utils.SharedPrefs.getAdminToken(context)
                if (adminToken != null && adminToken.isNotEmpty()) {
                    requestBuilder.addHeader("Authorization", "Bearer $adminToken")
                    android.util.Log.d("ApiClient", "✅ Added Authorization header with admin token")
                } else {
                    android.util.Log.w("ApiClient", "⚠️ No admin token available - request may fail with 401")
                }
                
                chain.proceed(requestBuilder.build())
            }
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
        
        retrofit = Retrofit.Builder()
            .baseUrl("$baseUrl/api/")
            .client(client)
            .addConverterFactory(UnwrappingJsonConverterFactory(gson))
            .build()
    }
    
    /**
     * Re-initialize the API client (useful after login to pick up new authentication token)
     */
    fun reinitialize(context: Context) {
        android.util.Log.d("ApiClient", "🔄 Re-initializing API client with updated token")
        init(context)
    }
    
    fun getApiService(): ApiService {
        if (retrofit == null) {
            throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
        }
        return retrofit!!.create(ApiService::class.java)
    }
}

