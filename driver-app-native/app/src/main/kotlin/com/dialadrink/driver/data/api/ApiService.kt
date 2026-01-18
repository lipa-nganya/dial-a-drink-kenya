package com.dialadrink.driver.data.api

import com.dialadrink.driver.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    // Auth
    @POST("auth/send-otp")
    suspend fun sendOtp(@Body request: SendOtpRequest): Response<ApiResponse<OtpResponse>>
    
    @POST("drivers/phone/{phone}/verify-otp")
    suspend fun verifyOtp(
        @Path("phone") phone: String,
        @Body request: VerifyOtpRequest
    ): Response<ApiResponse<VerifyOtpResponse>>
    
    @GET("drivers/phone/{phone}")
    suspend fun getDriverByPhone(@Path("phone") phone: String): Response<ApiResponse<Driver>>
    
    @PUT("drivers/{id}")
    suspend fun updateDriver(
        @Path("id") driverId: Int,
        @Body request: UpdateDriverRequest
    ): Response<ApiResponse<Driver>>
    
    @PATCH("drivers/{id}/status")
    suspend fun updateDriverStatus(
        @Path("id") driverId: Int,
        @Body request: UpdateDriverStatusRequest
    ): Response<ApiResponse<Driver>>
    
    @POST("drivers/phone/{phone}/verify-pin")
    suspend fun verifyPin(
        @Path("phone") phone: String,
        @Body request: VerifyPinRequest
    ): Response<ApiResponse<VerifyPinResponse>>
    
    @POST("drivers/phone/{phone}/setup-pin")
    suspend fun setupPin(
        @Path("phone") phone: String,
        @Body request: SetupPinRequest
    ): Response<ApiResponse<SetupPinResponse>>
    
    // Push token
    @POST("drivers/push-token")
    suspend fun registerPushToken(@Body request: PushTokenRequest): Response<ApiResponse<PushTokenResponse>>
    
    // Orders
    @GET("drivers/{driverId}/orders")
    suspend fun getDriverOrders(@Path("driverId") driverId: Int): Response<ApiResponse<List<Order>>>
    
    @GET("drivers/{driverId}/orders/active")
    suspend fun getActiveOrders(@Path("driverId") driverId: Int): Response<ApiResponse<List<Order>>>
    
    @GET("driver-orders/{driverId}")
    suspend fun getDriverOrdersDirect(
        @Path("driverId") driverId: Int,
        @Query("status") status: String? = null,
        @Query("summary") summary: Boolean? = null // Request summary (no nested objects)
    ): Response<ApiResponse<List<Order>>> // Backend returns WRAPPED (sendSuccess(res, [...]))
    
    @GET("driver-orders/{driverId}/pending")
    suspend fun getPendingOrders(
        @Path("driverId") driverId: Int,
        @Query("summary") summary: Boolean? = null
    ): Response<ApiResponse<List<Order>>> // Backend returns WRAPPED (sendSuccess(res, [...]))
    
    @GET("drivers/{driverId}/orders/completed")
    suspend fun getCompletedOrders(@Path("driverId") driverId: Int): Response<ApiResponse<List<Order>>>
    
    @GET("driver-orders/{driverId}")
    suspend fun getCompletedOrdersWithDates(
        @Path("driverId") driverId: Int,
        @Query("status") status: String,
        @Query("startDate") startDate: String? = null,
        @Query("endDate") endDate: String? = null,
        @Query("summary") summary: Boolean? = null
    ): Response<ApiResponse<List<Order>>>
    
    @GET("orders/{orderId}")
    suspend fun getOrderDetails(@Path("orderId") orderId: Int): Response<ApiResponse<Order>>
    
    @PATCH("driver-orders/{orderId}/status")
    suspend fun updateOrderStatus(
        @Path("orderId") orderId: Int,
        @Body request: UpdateOrderStatusRequest
    ): Response<ApiResponse<Order>>
    
    @POST("driver-orders/{orderId}/respond")
    suspend fun respondToOrder(
        @Path("orderId") orderId: Int,
        @Body request: RespondToOrderRequest
    ): Response<ApiResponse<Order>> // Backend returns WRAPPED (sendSuccess(res, {...}))
    
    @POST("driver-orders/{orderId}/request-cancellation")
    suspend fun requestCancellation(
        @Path("orderId") orderId: Int,
        @Body request: RequestCancellationRequest
    ): Response<ApiResponse<Order>>
    
    @POST("driver-orders/{orderId}/initiate-payment")
    suspend fun initiatePayment(
        @Path("orderId") orderId: Int,
        @Body request: InitiatePaymentRequest
    ): Response<ApiResponse<Order>>
    
    @POST("driver-orders/{orderId}/confirm-cash-payment")
    suspend fun confirmCashPayment(
        @Path("orderId") orderId: Int,
        @Body request: ConfirmCashPaymentRequest
    ): Response<ApiResponse<Order>>
    
    // Wallet
    @GET("drivers/{driverId}/wallet")
    suspend fun getWallet(@Path("driverId") driverId: Int): Response<ApiResponse<Wallet>>
    
    @GET("driver-wallet/{driverId}")
    suspend fun getDriverWallet(@Path("driverId") driverId: Int): Response<ApiResponse<DriverWalletResponse>>
    
    @POST("driver-wallet/{driverId}/withdraw-savings")
    suspend fun withdrawSavings(
        @Path("driverId") driverId: Int,
        @Body request: WithdrawSavingsRequest
    ): Response<ApiResponse<WithdrawSavingsResponse>>
    
    @POST("driver-wallet/{driverId}/withdraw")
    suspend fun withdrawWallet(
        @Path("driverId") driverId: Int,
        @Body request: WithdrawSavingsRequest
    ): Response<ApiResponse<WithdrawWalletResponse>>
    
    // Cash At Hand
    @GET("driver-wallet/{driverId}/cash-at-hand")
    suspend fun getCashAtHand(@Path("driverId") driverId: Int): Response<ApiResponse<CashAtHandResponse>>
    
    @POST("driver-wallet/{driverId}/cash-at-hand/submit")
    suspend fun submitCashAtHand(
        @Path("driverId") driverId: Int,
        @Body request: SubmitCashAtHandRequest
    ): Response<ApiResponse<SubmitCashAtHandResponse>>
    
    // Cash Submissions
    @POST("driver-wallet/{driverId}/cash-submissions")
    suspend fun createCashSubmission(
        @Path("driverId") driverId: Int,
        @Body request: CreateCashSubmissionRequest
    ): Response<ApiResponse<CashSubmission>>
    
    @GET("driver-wallet/{driverId}/cash-submissions")
    suspend fun getCashSubmissions(
        @Path("driverId") driverId: Int,
        @Query("status") status: String? = null,
        @Query("limit") limit: Int? = null,
        @Query("offset") offset: Int? = null
    ): Response<ApiResponse<CashSubmissionsResponse>>
    
    @PATCH("driver-wallet/{driverId}/cash-submissions/{id}")
    suspend fun updateCashSubmission(
        @Path("driverId") driverId: Int,
        @Path("id") id: Int,
        @Body request: UpdateCashSubmissionRequest
    ): Response<ApiResponse<CashSubmission>>
    
    // Notifications
    @GET("drivers/{driverId}/notifications")
    suspend fun getNotifications(@Path("driverId") driverId: Int): Response<ApiResponse<List<Notification>>>
    
    @POST("drivers/{driverId}/notifications/{notificationId}/read")
    suspend fun markNotificationAsRead(
        @Path("driverId") driverId: Int,
        @Path("notificationId") notificationId: Int
    ): Response<ApiResponse<Unit>>
}

