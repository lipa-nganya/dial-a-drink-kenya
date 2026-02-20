package com.dialadrink.driver.data.api

import com.dialadrink.driver.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    // Auth
    @POST("auth/send-otp")
    suspend fun sendOtp(@Body request: SendOtpRequest): Response<ApiResponse<OtpResponse>>
    
    @POST("auth/verify-otp")
    suspend fun verifyOtp(@Body request: VerifyOtpRequestWithPhone): Response<ApiResponse<VerifyOtpResponse>>
    
    @POST("drivers/phone/{phone}/verify-otp")
    suspend fun verifyOtpDriver(
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
    
    // Admin mobile login
    @POST("admin/auth/mobile-login")
    suspend fun adminMobileLogin(@Body request: AdminMobileLoginRequest): Response<ApiResponse<AdminMobileLoginResponse>>
    
    // Check if phone exists as both driver and admin (public endpoint, no auth required)
    // Using admin endpoint which is now public (moved before verifyAdmin middleware)
    @GET("admin/check-phone/{phone}")
    suspend fun checkPhoneForUserTypes(@Path("phone") phone: String): Response<ApiResponse<PhoneCheckResponse>>
    
    // Admin PIN setup
    @POST("admin/phone/{phone}/set-pin")
    suspend fun setupAdminPin(
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

    @POST("driver-wallet/{driverId}/withdraw-savings")
    suspend fun withdrawSavingsAmountOnly(
        @Path("driverId") driverId: Int,
        @Body request: WithdrawSavingsAmountOnlyRequest
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
    
    @GET("driver-wallet/{driverId}/orders-for-order-payment")
    suspend fun getOrdersForOrderPayment(
        @Path("driverId") driverId: Int
    ): Response<ApiResponse<OrdersForOrderPaymentResponse>>

    @POST("driver-wallet/{driverId}/order-payment-stk-push")
    suspend fun orderPaymentStkPush(
        @Path("driverId") driverId: Int,
        @Body request: OrderPaymentStkPushRequest
    ): Response<ApiResponse<OrderPaymentStkPushResponse>>

    @GET("mpesa/poll-transaction/{checkoutRequestID}")
    suspend fun pollMpesaTransaction(
        @Path("checkoutRequestID") checkoutRequestID: String
    ): Response<MpesaPollResponse>

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
    
    // POS endpoints
    @GET("pos/drinks")
    suspend fun getPosDrinks(
        @Query("search") search: String? = null,
        @Query("limit") limit: Int = 10,
        @Query("offset") offset: Int = 0
    ): Response<PosProductsResponse>
    
    @GET("pos/customer/{phoneNumber}")
    suspend fun getPosCustomer(@Path("phoneNumber") phoneNumber: String): Response<ApiResponse<PosCustomer>>
    
    @GET("pos/customers/search")
    suspend fun searchCustomers(@Query("q") query: String): Response<ApiResponse<List<PosCustomer>>>

    @POST("pos/customer")
    suspend fun createPosCustomer(@Body request: CreatePosCustomerRequest): Response<ApiResponse<PosCustomer>>
    
    @GET("territories")
    suspend fun getTerritories(): Response<List<Territory>>
    
    @POST("pos/order/cash")
    suspend fun createPosOrder(@Body request: CreatePosOrderRequest): Response<ApiResponse<Order>>
    
    @POST("orders")
    suspend fun createOrder(@Body request: CreateOrderRequest): Response<ApiResponse<Order>>
    
    // Places API endpoints (for cost-saving address autocomplete)
    @POST("places/autocomplete")
    suspend fun getAddressSuggestions(@Body request: PlacesAutocompleteRequest): Response<PlacesAutocompleteResponse>
    
    @POST("places/save")
    suspend fun saveAddress(@Body request: SaveAddressRequest): Response<ApiResponse<SavedAddress>>
    
    @GET("places/details/{placeId}")
    suspend fun getPlaceDetails(@Path("placeId") placeId: String): Response<PlaceDetails>
    
    // Admin endpoints for assign rider
    @GET("admin/orders/unassigned")
    suspend fun getUnassignedOrders(): Response<UnassignedOrdersResponse>
    
    @GET("admin/orders/pending")
    suspend fun getAdminPendingOrders(
        @Query("summary") summary: Boolean? = null
    ): Response<ApiResponse<List<Order>>>
    
    @GET("admin/orders/in-progress")
    suspend fun getAdminInProgressOrders(
        @Query("summary") summary: Boolean? = null
    ): Response<ApiResponse<List<Order>>>
    
    @GET("admin/orders")
    suspend fun getAdminOrders(): Response<List<Order>>
    
    @GET("admin/drivers/completed")
    suspend fun getCompletedDrivers(): Response<ApiResponse<List<Driver>>>
    
    @GET("admin/drivers/{driverId}/transactions")
    suspend fun getDriverTransactions(
        @Path("driverId") driverId: Int
    ): Response<ApiResponse<List<DriverTransaction>>>
    
    @POST("admin/drivers/{driverId}/request-payment")
    suspend fun requestPaymentFromDriver(
        @Path("driverId") driverId: Int,
        @Body request: RequestPaymentRequest
    ): Response<ApiResponse<RequestPaymentResponse>>
    
    @GET("drivers")
    suspend fun getDrivers(): Response<ApiResponse<List<Driver>>>
    
    @GET("admin/drivers/loans")
    suspend fun getDriversWithLoanBalances(): Response<ApiResponse<List<DriverWithLoanBalance>>>
    
    @GET("admin/drivers/penalties")
    suspend fun getDriversWithPenaltyBalances(): Response<ApiResponse<List<DriverWithPenaltyBalance>>>
    
   
    @GET("admin/drivers/{driverId}/loan-penalty-transactions")
    suspend fun getLoanPenaltyTransactions(@Path("driverId") driverId: Int): Response<ApiResponse<List<DriverTransaction>>>
    
    @POST("admin/loans")
    suspend fun createLoan(@Body request: CreateLoanRequest): Response<ApiResponse<Any>>
    
    @PATCH("admin/orders/{orderId}/driver")
    suspend fun assignDriverToOrder(
        @Path("orderId") orderId: Int,
        @Body request: AssignDriverRequest
    ): Response<ApiResponse<Order>>
    
    @PATCH("admin/orders/{orderId}/delivery-fee")
    suspend fun updateOrderDeliveryFee(
        @Path("orderId") orderId: Int,
        @Body request: UpdateDeliveryFeeRequest
    ): Response<ApiResponse<Order>>
    
    @PATCH("admin/orders/{orderId}/items/{itemId}/price")
    suspend fun updateOrderItemPrice(
        @Path("orderId") orderId: Int,
        @Path("itemId") itemId: Int,
        @Body request: UpdateItemPriceRequest
    ): Response<ApiResponse<Order>>
    
    @PATCH("admin/orders/{orderId}/status")
    suspend fun updateAdminOrderStatus(
        @Path("orderId") orderId: Int,
        @Body request: UpdateOrderStatusRequest
    ): Response<ApiResponse<Order>>

    @PATCH("admin/orders/{orderId}/payment-status")
    suspend fun updateOrderPaymentStatus(
        @Path("orderId") orderId: Int,
        @Body request: UpdatePaymentStatusRequest
    ): Response<ApiResponse<Order>>    @POST("admin/orders/{orderId}/prompt-payment")
    suspend fun promptOrderPayment(
        @Path("orderId") orderId: Int,
        @Body request: PromptOrderPaymentRequest? = null
    ): Response<ApiResponse<Any>>
}
