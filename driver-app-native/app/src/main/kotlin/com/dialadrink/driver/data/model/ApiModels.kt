package com.dialadrink.driver.data.model

import com.google.gson.annotations.SerializedName

// Generic API Response
data class ApiResponse<T>(
    val success: Boolean? = null,
    val data: T? = null,
    val error: String? = null
)

// Auth Models
data class SendOtpRequest(
    val phone: String,
    val userType: String = "driver",
    val resetPin: Boolean? = null
)

data class OtpResponse(
    val message: String
)

data class VerifyOtpRequest(
    val otp: String
)

data class VerifyOtpResponse(
    val success: Boolean,
    val hasPin: Boolean
)

data class VerifyPinRequest(
    val pin: String
)

data class VerifyPinResponse(
    val success: Boolean
)

data class SetupPinRequest(
    val pin: String
)

data class SetupPinResponse(
    val success: Boolean
)

// Driver Model
data class Driver(
    val id: Int,
    val name: String,
    val phoneNumber: String,
    val hasPin: Boolean? = null,
    val pushToken: String? = null,
    val status: String? = null,
    @SerializedName("cashAtHand") val cashAtHand: Double? = null,
    @SerializedName("creditLimit") val creditLimit: Double? = null
)

data class UpdateDriverRequest(
    val status: String? = null
)

data class UpdateDriverStatusRequest(
    val status: String
)

// Push Token
data class PushTokenRequest(
    val driverId: Int,
    val pushToken: String,
    val tokenType: String = "fcm"
)

data class PushTokenResponse(
    val success: Boolean
)

// Order Models
data class Order(
    val id: Int,
    val customerName: String,
    val customerPhone: String,
    val deliveryAddress: String,
    val status: String,
    val paymentStatus: String,
    val totalAmount: Double,
    val tipAmount: Double = 0.0,
    val items: List<OrderItem> = emptyList(),
    val driverId: Int? = null,
    val driverAccepted: Boolean? = null,
    val createdAt: String? = null,
    val paymentType: String? = null, // "pay_now" or "pay_on_delivery"
    val paymentMethod: String? = null, // "card", "mobile_money", "cash"
    val branch: Branch? = null,
    val transactionCode: String? = null, // M-Pesa transaction code (receiptNumber)
    val transactionDate: String? = null, // Transaction date/time
    @SerializedName("cancellationRequested") val cancellationRequested: Boolean? = null,
    @SerializedName("cancellationReason") val cancellationReason: String? = null,
    @SerializedName("cancellationApproved") val cancellationApproved: Boolean? = null
)

data class Branch(
    val id: Int,
    val name: String,
    val address: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class OrderItem(
    val id: Int,
    val drinkId: Int,
    val quantity: Int,
    val price: Double,
    val drink: Drink? = null
)

data class Drink(
    val id: Int,
    val name: String,
    val price: Double,
    val image: String? = null
)

data class UpdateOrderStatusRequest(
    val status: String,
    val driverId: Int
)

data class RespondToOrderRequest(
    val driverId: Int,
    val accepted: Boolean
)

data class RequestCancellationRequest(
    val driverId: Int,
    val reason: String
)

data class InitiatePaymentRequest(
    val driverId: Int,
    val customerPhone: String
)

data class ConfirmCashPaymentRequest(
    val driverId: Int,
    val method: String = "cash",
    val receiptNumber: String? = null
)

// Wallet Models
data class Wallet(
    val id: Int,
    val balance: Double,
    val driverId: Int,
    val transactions: List<Transaction> = emptyList()
)

data class Transaction(
    val id: Int,
    val amount: Double,
    val type: String,
    val description: String,
    val createdAt: String
)

// Driver Wallet Response (from /api/driver-wallet/:driverId)
data class DriverWalletResponse(
    val wallet: DriverWalletInfo,
    val savingsWithdrawal: SavingsWithdrawalInfo? = null,
    val recentTips: List<WalletTransaction>? = null,
    val recentDeliveryPayments: List<WalletTransaction>? = null,
    val cashSettlements: List<WalletTransaction>? = null,
    val recentWithdrawals: List<WalletWithdrawal>? = null
)

data class DriverWalletInfo(
    val id: Int,
    val driverId: Int,
    val balance: Double,
    val availableBalance: Double? = null,
    val amountOnHold: Double? = null,
    val savings: Double? = null,
    val totalTipsReceived: Double? = null,
    val totalTipsCount: Int? = null,
    val totalDeliveryPay: Double? = null,
    val totalDeliveryPayCount: Int? = null
)

data class SavingsWithdrawalInfo(
    val dailyLimit: Double,
    val todayWithdrawn: Double,
    val remainingDailyLimit: Double,
    val canWithdraw: Boolean
)

data class WithdrawSavingsRequest(
    val amount: Double,
    val phoneNumber: String
)

data class WithdrawSavingsResponse(
    val transaction: SavingsWithdrawalTransaction,
    val newSavings: Double,
    val remainingDailyLimit: Double,
    val note: String
)

data class WithdrawWalletResponse(
    val transaction: WalletWithdrawalTransaction,
    val newBalance: Double,
    val note: String
)

data class WalletWithdrawalTransaction(
    val id: Int,
    val amount: Double,
    val phoneNumber: String,
    val status: String,
    val conversationID: String?
)

data class SavingsWithdrawalTransaction(
    val id: Int,
    val amount: Double,
    val phoneNumber: String,
    val status: String,
    val conversationID: String?
)

data class WalletTransaction(
    val id: Int,
    val amount: Double,
    val transactionType: String? = null,
    val orderId: Int? = null,
    val orderNumber: Int? = null,
    val customerName: String? = null,
    val status: String? = null,
    val date: String,
    val notes: String? = null
)

data class WalletWithdrawal(
    val id: Int,
    val amount: Double,
    val phoneNumber: String? = null,
    val status: String? = null,
    val paymentStatus: String? = null,
    val receiptNumber: String? = null,
    val date: String,
    val notes: String? = null
)

// Cash At Hand Models
data class CashAtHandResponse(
    val totalCashAtHand: Double,
    val entries: List<CashAtHandEntry>
)

data class CashAtHandEntry(
    val type: String, // "cash_received" or "cash_sent"
    val orderId: Int? = null,
    val transactionId: Int? = null,
    val customerName: String? = null,
    val amount: Double,
    val date: String,
    val description: String,
    val receiptNumber: String? = null
)

data class SubmitCashAtHandRequest(
    val amount: Double
)

data class SubmitCashAtHandResponse(
    val transaction: CashAtHandTransaction? = null,
    val newCashAtHand: Double? = null,
    val previousCashAtHand: Double? = null,
    val message: String? = null,
    val checkoutRequestID: String? = null
)

data class CashAtHandTransaction(
    val id: Int,
    val amount: Double,
    val date: String? = null,
    val receiptNumber: String? = null,
    val status: String? = null,
    val checkoutRequestID: String? = null
)

// Cash Submission Models
data class CashSubmission(
    val id: Int,
    val driverId: Int,
    val submissionType: String, // "purchases", "cash", "general_expense", "payment_to_office"
    val status: String, // "pending", "approved", "rejected"
    val amount: Double,
    val details: Map<String, Any>? = null,
    val approvedBy: Int? = null,
    val rejectedBy: Int? = null,
    val approvedAt: String? = null,
    val rejectedAt: String? = null,
    val rejectionReason: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val driver: Driver? = null,
    val approver: Admin? = null,
    val rejector: Admin? = null
)

data class Admin(
    val id: Int,
    val username: String? = null,
    val name: String? = null
)

data class CreateCashSubmissionRequest(
    val submissionType: String,
    val amount: Double,
    val details: Map<String, Any>
)

data class UpdateCashSubmissionRequest(
    val amount: Double? = null,
    val details: Map<String, Any>? = null
)

data class CashSubmissionsResponse(
    val submissions: List<CashSubmission>,
    val counts: CashSubmissionCounts,
    val total: Int
)

data class CashSubmissionCounts(
    val pending: Int,
    val approved: Int,
    val rejected: Int
)

// Notification Models
data class Notification(
    val id: Int,
    val title: String,
    val preview: String,
    val message: String,
    val sentAt: String,
    val isRead: Boolean,
    val readAt: String? = null
)
