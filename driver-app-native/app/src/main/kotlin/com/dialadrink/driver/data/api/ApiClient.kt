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
    private var appContext: Context? = null
    private val baseUrl = BuildConfig.API_BASE_URL
    
    // Single Gson instance app-wide
    val gson: com.google.gson.Gson = GsonBuilder()
        .setLenient()
        .create()
    
    fun isInitialized(): Boolean {
        return retrofit != null
    }
    
    
    fun init(context: Context) {
        appContext = context.applicationContext
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
                
                // Add authentication token if available (admin or shop agent)
                val adminToken = com.dialadrink.driver.utils.SharedPrefs.getAdminToken(context)
                val shopAgentToken = com.dialadrink.driver.utils.SharedPrefs.getShopAgentToken(context)
                
                when {
                    adminToken != null && adminToken.isNotEmpty() -> {
                        requestBuilder.addHeader("Authorization", "Bearer $adminToken")
                        android.util.Log.d("ApiClient", "✅ Added Authorization header with admin token")
                    }
                    shopAgentToken != null && shopAgentToken.isNotEmpty() -> {
                        requestBuilder.addHeader("Authorization", "Bearer $shopAgentToken")
                        android.util.Log.d("ApiClient", "✅ Added Authorization header with shop agent token")
                    }
                    else -> {
                        android.util.Log.w("ApiClient", "⚠️ No authentication token available - request may fail with 401")
                    }
                }
                
                chain.proceed(requestBuilder.build())
            }
            .addNetworkInterceptor { chain ->
                val response = chain.proceed(chain.request())
                val ctx = appContext
                if (ctx == null || response.code != 403) {
                    return@addNetworkInterceptor response
                }
                val adminTok = com.dialadrink.driver.utils.SharedPrefs.getAdminToken(ctx)
                if (adminTok.isNullOrEmpty()) {
                    return@addNetworkInterceptor response
                }
                val peeked = try {
                    response.peekBody(8192).string()
                } catch (_: Exception) {
                    ""
                }
                if (!peeked.contains("ADMIN_PAYWALL")) {
                    return@addNetworkInterceptor response
                }
                android.os.Handler(android.os.Looper.getMainLooper()).post {
                    com.dialadrink.driver.utils.SharedPrefs.clearAdminSession(ctx)
                    val intent = android.content.Intent(ctx, com.dialadrink.driver.ui.admin.AdminPaywallActivity::class.java).apply {
                        addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    }
                    ctx.startActivity(intent)
                }
                response
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

