package com.dialadrink.driver.services

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.dialadrink.driver.BuildConfig
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

object SocketService {
    private const val TAG = "SocketService"
    private var socket: Socket? = null
    private var handlersRegistered = false
    
    // Store multiple callbacks so multiple activities can listen
    private val orderAssignedCallbacks = mutableListOf<(JSONObject) -> Unit>()
    private val orderStatusUpdatedCallbacks = mutableListOf<(JSONObject) -> Unit>()
    private val paymentConfirmedCallbacks = mutableListOf<(JSONObject) -> Unit>()
    
    fun getSocketUrl(): String {
        // Get base URL from build config and remove /api suffix
        val baseUrl = BuildConfig.API_BASE_URL
        return baseUrl.replace("/api", "").replace("/api/", "")
    }
    
    fun connect(
        driverId: Int, 
        onOrderAssigned: (order: JSONObject) -> Unit,
        onOrderStatusUpdated: ((order: JSONObject) -> Unit)? = null,
        onPaymentConfirmed: ((paymentData: JSONObject) -> Unit)? = null
    ) {
        val socketUrl = getSocketUrl()
        
        // Add callbacks to lists (multiple activities can register)
        orderAssignedCallbacks.add(onOrderAssigned)
        onOrderStatusUpdated?.let { orderStatusUpdatedCallbacks.add(it) }
        onPaymentConfirmed?.let { paymentConfirmedCallbacks.add(it) }
        
        Log.d(TAG, "📝 Callbacks registered. Total: ${orderAssignedCallbacks.size} assigned, ${orderStatusUpdatedCallbacks.size} status, ${paymentConfirmedCallbacks.size} payment")
        
        // If socket is already connected, ensure handlers are set up and driver is registered
        if (socket?.connected() == true) {
            Log.d(TAG, "Socket already connected, ensuring handlers are registered and re-registering driver")
            
            // If handlers aren't registered yet, register them now
            if (!handlersRegistered) {
                Log.w(TAG, "⚠️ Handlers not registered but socket is connected! Registering now...")
                registerEventHandlers()
            }
            
            // Re-register driver to ensure we're in the correct room
            socket?.emit("register-driver", driverId)
            Log.d(TAG, "✅ Re-registered driver $driverId with socket")
            
            return
        }
        
        Log.d(TAG, "🔌 Connecting to socket: $socketUrl")
        
        try {
            val options = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                // Default is ~20s; set explicitly so it's predictable across devices/builds.
                timeout = 20_000
                reconnection = true
                // Keep trying; drivers may be on unstable networks.
                reconnectionAttempts = Int.MAX_VALUE
                reconnectionDelay = 1000
                reconnectionDelayMax = 10_000
                forceNew = true
            }
            
            socket = IO.socket(socketUrl, options)
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "✅✅✅ Socket.IO connected successfully")
                Log.d(TAG, "✅ Socket ID: ${socket?.id()}")
                
                // Register driver
                socket?.emit("register-driver", driverId)
                Log.d(TAG, "✅ Registered driver $driverId with socket")
            }
            
            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Log.e(TAG, "❌ Socket.IO connection error: ${args[0]}")
            }
            
            socket?.on(Socket.EVENT_DISCONNECT) { args ->
                Log.d(TAG, "❌ Socket.IO disconnected: ${args[0]}")
            }
            
            // Reconnection is handled automatically by socket.io-client
            // When reconnected, EVENT_CONNECT will fire again and we'll re-register the driver
            
            // Register event handlers
            registerEventHandlers()
            
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error creating socket connection", e)
        }
    }
    
    private fun registerEventHandlers() {
        if (handlersRegistered) {
            Log.d(TAG, "Event handlers already registered, skipping")
            return
        }
        
        Log.d(TAG, "📡 Registering socket event handlers...")
        
        // Listen for order-assigned event - call all registered callbacks
        socket?.on("order-assigned") { args ->
                Log.d(TAG, "📦 Order assigned via socket: ${args[0]}")
                try {
                    val orderData = args[0] as? JSONObject
                    if (orderData != null) {
                        Log.d(TAG, "📦 Calling ${orderAssignedCallbacks.size} order-assigned callbacks")
                        val data = orderData
                        Handler(Looper.getMainLooper()).post {
                            orderAssignedCallbacks.forEach { callback ->
                                try {
                                    callback(data)
                                } catch (e: Exception) {
                                    Log.e(TAG, "❌ Error in order-assigned callback", e)
                                }
                            }
                        }
                    } else {
                        Log.e(TAG, "❌ Invalid order data in socket event")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-assigned event", e)
                }
            }
            
            // Listen for order status updates - call all registered callbacks
            socket?.on("order-status-updated") { args ->
                Log.d(TAG, "📦 Order status updated via socket: ${args[0]}")
                try {
                    val orderData = args[0] as? JSONObject
                    if (orderData != null) {
                        Log.d(TAG, "📦 Calling ${orderStatusUpdatedCallbacks.size} order-status-updated callbacks")
                        val data = orderData
                        Handler(Looper.getMainLooper()).post {
                            orderStatusUpdatedCallbacks.forEach { callback ->
                                try {
                                    callback(data)
                                } catch (e: Exception) {
                                    Log.e(TAG, "❌ Error in order-status-updated callback", e)
                                }
                            }
                        }
                    } else {
                        Log.e(TAG, "❌ Invalid order data in socket event")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-status-updated event", e)
                }
            }
            
            // Listen for payment events - call all registered callbacks
            socket?.on("payment-confirmed") { args ->
                Log.d(TAG, "💰 Payment confirmed via socket: ${args[0]}")
                try {
                    val paymentData = args[0] as? JSONObject
                    if (paymentData != null) {
                        Log.d(TAG, "💰 Calling ${paymentConfirmedCallbacks.size} payment-confirmed callbacks")
                        val data = paymentData
                        Handler(Looper.getMainLooper()).post {
                            paymentConfirmedCallbacks.forEach { callback ->
                                try {
                                    callback(data)
                                } catch (e: Exception) {
                                    Log.e(TAG, "❌ Error in payment-confirmed callback", e)
                                }
                            }
                        }
                    } else {
                        Log.e(TAG, "❌ Invalid payment data in socket event")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling payment-confirmed event", e)
                }
            }
        
        handlersRegistered = true
        Log.d(TAG, "✅ Event handlers registered successfully")
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket = null
        handlersRegistered = false
        // Clear all callbacks when disconnecting
        orderAssignedCallbacks.clear()
        orderStatusUpdatedCallbacks.clear()
        paymentConfirmedCallbacks.clear()
        Log.d(TAG, "Socket disconnected and callbacks cleared")
    }
    
    fun removeCallbacks(
        onOrderAssigned: (order: JSONObject) -> Unit,
        onOrderStatusUpdated: ((order: JSONObject) -> Unit)? = null,
        onPaymentConfirmed: ((paymentData: JSONObject) -> Unit)? = null
    ) {
        // Remove specific callbacks when an activity is destroyed
        orderAssignedCallbacks.remove(onOrderAssigned)
        onOrderStatusUpdated?.let { orderStatusUpdatedCallbacks.remove(it) }
        onPaymentConfirmed?.let { paymentConfirmedCallbacks.remove(it) }
        Log.d(TAG, "Callbacks removed. Remaining: ${orderAssignedCallbacks.size} assigned, ${orderStatusUpdatedCallbacks.size} status, ${paymentConfirmedCallbacks.size} payment")
    }
    
    fun isConnected(): Boolean {
        return socket?.connected() == true
    }
    
    fun joinOrderRoom(orderId: Int) {
        socket?.emit("join-order", orderId)
        Log.d(TAG, "Joined order room: $orderId")
    }
}

