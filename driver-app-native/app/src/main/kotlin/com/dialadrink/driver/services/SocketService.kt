package com.dialadrink.driver.services

import android.util.Log
import com.dialadrink.driver.BuildConfig
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

object SocketService {
    private const val TAG = "SocketService"
    private var socket: Socket? = null
    
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
        
        // If socket is already connected, just register the handlers (Socket.IO supports multiple listeners)
        if (socket?.connected() == true) {
            Log.d(TAG, "Socket already connected, registering handlers")
            
            // Always register handlers, even if socket is already connected
            // This allows multiple activities to listen to the same events
            socket?.on("order-assigned") { args ->
                Log.d(TAG, "📦 Order assigned via socket: ${args[0]}")
                try {
                    val orderData = args[0] as? JSONObject
                    if (orderData != null) {
                        onOrderAssigned(orderData)
                    } else {
                        Log.e(TAG, "❌ Invalid order data in socket event")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-assigned event", e)
                }
            }
            
            socket?.on("order-status-updated") { args ->
                Log.d(TAG, "📦 Order status updated via socket: ${args[0]}")
                try {
                    val orderData = args[0] as? JSONObject
                    if (orderData != null && onOrderStatusUpdated != null) {
                        onOrderStatusUpdated(orderData)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-status-updated event", e)
                }
            }
            
            socket?.on("payment-confirmed") { args ->
                Log.d(TAG, "💰 Payment confirmed via socket: ${args[0]}")
                try {
                    val paymentData = args[0] as? JSONObject
                    if (paymentData != null && onPaymentConfirmed != null) {
                        onPaymentConfirmed(paymentData)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling payment-confirmed event", e)
                }
            }
            
            return
        }
        
        Log.d(TAG, "🔌 Connecting to socket: $socketUrl")
        
        try {
            val options = IO.Options().apply {
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionAttempts = 5
                reconnectionDelay = 1000
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
            
            // Listen for order-assigned event
            socket?.on("order-assigned") { args ->
                Log.d(TAG, "📦 Order assigned via socket: ${args[0]}")
                try {
                    val orderData = args[0] as? JSONObject
                    if (orderData != null) {
                        onOrderAssigned(orderData)
                    } else {
                        Log.e(TAG, "❌ Invalid order data in socket event")
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-assigned event", e)
                }
            }
            
            // Listen for order status updates
            socket?.on("order-status-updated") { args ->
                Log.d(TAG, "📦 Order status updated via socket: ${args[0]}")
                try {
                    val orderData = args[0] as? JSONObject
                    if (orderData != null && onOrderStatusUpdated != null) {
                        onOrderStatusUpdated(orderData)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling order-status-updated event", e)
                }
            }
            
            // Listen for payment events
            socket?.on("payment-confirmed") { args ->
                Log.d(TAG, "💰 Payment confirmed via socket: ${args[0]}")
                try {
                    val paymentData = args[0] as? JSONObject
                    if (paymentData != null && onPaymentConfirmed != null) {
                        onPaymentConfirmed(paymentData)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error handling payment-confirmed event", e)
                }
            }
            
            socket?.connect()
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error creating socket connection", e)
        }
    }
    
    fun disconnect() {
        socket?.disconnect()
        socket = null
        Log.d(TAG, "Socket disconnected")
    }
    
    fun isConnected(): Boolean {
        return socket?.connected() == true
    }
    
    fun joinOrderRoom(orderId: Int) {
        socket?.emit("join-order", orderId)
        Log.d(TAG, "Joined order room: $orderId")
    }
}

