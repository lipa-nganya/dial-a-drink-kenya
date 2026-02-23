package com.dialadrink.driver.services

import android.content.Context
import android.util.Log
import com.dialadrink.driver.data.api.ApiClient
import com.dialadrink.driver.data.model.PushTokenRequest
import com.dialadrink.driver.data.model.ShopAgentPushTokenRequest
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

object FcmService {
    private const val TAG = "FcmService"
    
    fun registerPushToken(context: Context, driverId: Int) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Get native FCM token (using google-services.json)
                val token = FirebaseMessaging.getInstance().token.await()
                
                Log.d(TAG, "✅ Native FCM Token acquired: ${token.take(50)}...")
                
                // Send to backend
                val response = ApiClient.getApiService().registerPushToken(
                    PushTokenRequest(
                        driverId = driverId,
                        pushToken = token,
                        tokenType = "native" // Native FCM token
                    )
                )
                
                if (response.isSuccessful) {
                    Log.d(TAG, "✅ Push token registered successfully with backend")
                } else {
                    Log.e(TAG, "❌ Failed to register push token: ${response.message()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error registering push token", e)
                Log.e(TAG, "Error details: ${e.message}")
            }
        }
    }
    
    fun registerShopAgentPushToken(context: Context, shopAgentId: Int) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Get native FCM token (using google-services.json)
                val token = FirebaseMessaging.getInstance().token.await()
                
                Log.d(TAG, "✅ Native FCM Token acquired for shop agent: ${token.take(50)}...")
                
                // Send to backend
                val response = ApiClient.getApiService().registerShopAgentPushToken(
                    ShopAgentPushTokenRequest(
                        shopAgentId = shopAgentId,
                        pushToken = token,
                        tokenType = "native" // Native FCM token
                    )
                )
                
                if (response.isSuccessful) {
                    Log.d(TAG, "✅ Shop agent push token registered successfully with backend")
                } else {
                    Log.e(TAG, "❌ Failed to register shop agent push token: ${response.message()}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error registering shop agent push token", e)
                Log.e(TAG, "Error details: ${e.message}")
            }
        }
    }
}

