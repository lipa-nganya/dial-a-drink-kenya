package com.dialadrink.driver.data.model

import android.os.Parcelable
import com.google.gson.*
import com.google.gson.annotations.JsonAdapter
import com.google.gson.annotations.SerializedName
import kotlinx.parcelize.Parcelize
import java.lang.reflect.Type

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

data class VerifyOtpRequestWithPhone(
    val phone: String,
    val otpCode: String? = null,
    val otp: String? = null
)

data class VerifyOtpResponse(
    val success: Boolean,
    val hasPin: Boolean? = null,
    val isDriver: Boolean? = null,
    val isAdmin: Boolean? = null,
    val driver: DriverInfo? = null,
    val admin: AdminInfo? = null
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

// Admin Models
data class AdminMobileLoginRequest(
    val phone: String,
    val pin: String
)

data class AdminMobileLoginResponse(
    val success: Boolean,
    val message: String,
    val token: String?,
    val user: AdminUser?
)

data class AdminUser(
    val id: Int,
    val username: String,
    val email: String?,
    val mobileNumber: String?,
    val role: String,
    val name: String?
)

data class PhoneCheckResponse(
    val driver: DriverInfo?,
    val admin: AdminInfo?,
    val customer: CustomerInfo? = null
) {
    // Computed properties for backward compatibility
    val isDriver: Boolean get() = driver != null
    val isAdmin: Boolean get() = admin != null
}

data class CustomerInfo(
    val id: Int,
    val phone: String?,
    val username: String?,
    val hasPin: Boolean? = null
)

data class DriverInfo(
    val id: Int,
    val name: String,
    val phoneNumber: String? = null,
    val hasPin: Boolean? = null
)

data class AdminInfo(
    val id: Int,
    val name: String? = null,
    val mobileNumber: String? = null,
    val username: String? = null,
    val hasPin: Boolean? = null
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
    val deliveryFee: Double = 0.0,
    val items: List<OrderItem> = emptyList(),
    val driverId: Int? = null,
    val driverAccepted: Boolean? = null,
    val driver: Driver? = null, // Driver object from backend
    val createdAt: String? = null,
    val updatedAt: String? = null, // Order update timestamp
    val paymentType: String? = null, // "pay_now" or "pay_on_delivery"
    val paymentMethod: String? = null, // "card", "mobile_money", "cash"
    val branch: Branch? = null,
    val territory: Territory? = null,
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
    val image: String? = null,
    val purchasePrice: Double? = null
)

data class UpdateOrderStatusRequest(
    val status: String,
    val driverId: Int
)

data class UpdatePaymentStatusRequest(
    val paymentStatus: String
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
    val recentSavingsCredits: List<WalletTransaction>? = null,
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
    val phoneNumber: String? = null  // Optional; when null, record-only (no M-Pesa)
)

/** Request body for savings withdrawal (amount only, no phone). */
data class WithdrawSavingsAmountOnlyRequest(
    val amount: Double
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
    val orderLocation: String? = null,
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
    val entries: List<CashAtHandEntry>,
    @SerializedName("pendingSubmissionsTotal") val pendingSubmissionsTotal: Double? = null,
    @SerializedName("pendingCashAtHand") val pendingCashAtHand: Double? = null
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

data class OrderForOrderPayment(
    val orderId: Int,
    val customerName: String,
    val itemsTotal: Double,
    val deliveryFee: Double,
    val savings: Double,
    val totalToSubmit: Double,
    val createdAt: String? = null
)

data class OrdersForOrderPaymentResponse(
    val orders: List<OrderForOrderPayment>
)

data class OrderPaymentStkPushRequest(
    val orderId: Int,
    val phoneNumber: String? = null
)

data class OrderPaymentStkPushResponse(
    val checkoutRequestID: String? = null,
    val orderId: Int? = null,
    val amount: Double? = null,
    val message: String? = null
)

data class MpesaPollResponse(
    val success: Boolean? = null,
    val status: String? = null,
    val paymentStatus: String? = null,
    val receiptNumber: String? = null
)

data class CreateCashSubmissionRequest(
    val submissionType: String,
    val amount: Double,
    val details: Map<String, Any>,
    val orderId: Int? = null
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

// Alias for push notifications (used in UI)
typealias PushNotification = Notification

// Custom deserializer for capacity field that handles both string and array
class CapacityDeserializer : JsonDeserializer<List<String>?> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): List<String>? {
        if (json == null || json.isJsonNull) {
            return null
        }
        return when {
            json.isJsonArray -> {
                json.asJsonArray.mapNotNull { element ->
                    if (element.isJsonPrimitive) element.asString else null
                }
            }
            json.isJsonPrimitive -> {
                val str = json.asString
                if (str.isBlank()) null else listOf(str)
            }
            else -> null
        }
    }
}

// Custom deserializer for price field that handles both string and number
class PriceDeserializer : JsonDeserializer<Double> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): Double {
        if (json == null || json.isJsonNull) {
            return 0.0
        }
        return when {
            json.isJsonPrimitive -> {
                val primitive = json.asJsonPrimitive
                when {
                    primitive.isString -> primitive.asString.toDoubleOrNull() ?: 0.0
                    primitive.isNumber -> primitive.asDouble
                    else -> 0.0
                }
            }
            else -> 0.0
        }
    }
}

// POS Models
data class PosProduct(
    val id: Int,
    val name: String,
    @JsonAdapter(CapacityDeserializer::class)
    val capacity: List<String>? = null, // Backend returns capacity as string or array
    val stock: Int? = 0,
    @JsonAdapter(PriceDeserializer::class)
    val price: Double,
    val barcode: String? = null,
    val category: PosCategory? = null,
    val purchasePrice: Double? = null // Purchase price for profit/loss calculation
) {
    // Helper property to get capacity as a formatted string for display
    val capacityDisplay: String?
        get() = capacity?.joinToString(", ") ?: null
}

data class PosCategory(
    val id: Int,
    val name: String
)

data class PosProductsResponse(
    val products: List<PosProduct>,
    val total: Int,
    val limit: Int,
    val offset: Int,
    val hasMore: Boolean
)

data class PosCustomer(
    val id: Int? = null,
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val exists: Boolean = false
)

data class CreatePosCustomerRequest(
    val name: String,
    val phone: String,
    val email: String? = null
)

data class Territory(
    val id: Int,
    val name: String,
    @SerializedName("deliveryFromCBD") val deliveryFromCBD: Double? = null,
    @SerializedName("deliveryFromRuaka") val deliveryFromRuaka: Double? = null
)

@Parcelize
data class PosCartItem(
    val drinkId: Int,
    val name: String,
    val capacity: String?,
    val price: Double,
    var quantity: Int,
    var availableStock: Int,
    val purchasePrice: Double? = null // Purchase price for profit/loss calculation
) : Parcelable

// Loan Models
data class DriverWithLoanBalance(
    val id: Int,
    val name: String,
    val phoneNumber: String,
    val loanBalance: Double
)

data class DriverWithPenaltyBalance(
    val id: Int,
    val name: String,
    val phoneNumber: String,
    val penaltyBalance: Double
)

data class CreateLoanRequest(
    val driverId: Int,
    val amount: Double,
    val reason: String,
    val type: String? = null // "loan" or "penalty", defaults to "loan" if null
)

data class CreatePosOrderRequest(
    val customerName: String,
    val customerPhone: String,
    val customerEmail: String? = null,
    val items: List<PosOrderItem>,
    val notes: String? = null,
    val branchId: Int? = null,
    val amountPaid: Double? = null,
    val deliveryAddress: String? = null,
    val deliveryFee: Double? = null,
    val territoryId: Int? = null
)

data class CreateOrderRequest(
    val customerName: String,
    val customerPhone: String? = null,
    val customerEmail: String? = null,
    val deliveryAddress: String,
    val items: List<PosOrderItem>,
    val paymentType: String = "pay_now",
    val paymentMethod: String? = null,
    val paymentStatus: String = "paid",
    val status: String = "pending",
    val adminOrder: Boolean = true,
    val deliveryFee: Double? = null,
    val territoryId: Int? = null,
    val notes: String? = null,
    val driverId: Int? = null, // Driver ID for staff purchases with cash at hand
    val isStop: Boolean? = null, // Whether this order is a stop (deducts from driver savings)
    val stopDeductionAmount: Double? = null // Amount to deduct from driver savings when order is completed
)

data class AssignDriverRequest(
    val driverId: Int?
)

data class UnassignedOrdersResponse(
    val orders: List<Order>,
    val driverOrderCounts: Map<String, Int>? = null
)

// Driver Transaction Model (for admin completed screen)
data class DriverTransaction(
    val id: Int,
    val orderId: Int? = null,
    val date: String? = null,
    val location: String? = null,
    val paymentMethod: String? = null,
    val amount: Double? = null,
    val deliveryFee: Double? = null,
    // Additional fields for loan/penalty transactions
    val driverId: Int? = null,
    val driverWalletId: Int? = null,
    val transactionType: String? = null,
    val paymentProvider: String? = null,
    val status: String? = null,
    val paymentStatus: String? = null,
    val notes: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

// Request Payment Models
data class RequestPaymentRequest(
    val amount: Double,
    val type: String // "mpesa" or "reminder"
)

data class PromptOrderPaymentRequest(
    val customerPhone: String? = null
)

data class RequestPaymentResponse(
    val message: String,
    val checkoutRequestID: String? = null,
    val notificationId: Int? = null,
    val pushSent: Boolean? = null
)

data class DriverWithOrderCount(
    val id: Int,
    val name: String,
    val phoneNumber: String,
    val orderCount: Int = 0
)

data class UpdateDeliveryFeeRequest(
    val deliveryFee: Double
)

data class UpdateItemPriceRequest(
    val price: Double
)

data class PosOrderItem(
    val drinkId: Int,
    val quantity: Int,
    val selectedPrice: Double? = null
)

// Places API Models (for cost-saving address autocomplete)
data class PlacesAutocompleteRequest(
    val input: String
)

data class AddressSuggestion(
    val placeId: String?,
    val description: String,
    val structuredFormat: StructuredFormat? = null,
    val fromDatabase: Boolean? = false
)

data class StructuredFormat(
    val main_text: String? = null,
    val secondary_text: String? = null
)

data class PlacesAutocompleteResponse(
    val suggestions: List<AddressSuggestion>? = null,
    val fromDatabase: Boolean? = false,
    val hasGoogleResults: Boolean? = false,
    val error: String? = null
)

data class SaveAddressRequest(
    val address: String,
    val placeId: String? = null,
    val formattedAddress: String? = null
)

data class SavedAddress(
    val id: Int? = null,
    val address: String,
    val placeId: String? = null,
    val formattedAddress: String? = null
)

data class PlaceDetails(
    val place_id: String? = null,
    val formatted_address: String? = null,
    val name: String? = null,
    val geometry: PlaceGeometry? = null,
    val address_components: List<AddressComponent>? = null
)

data class PlaceGeometry(
    val location: PlaceLocation? = null
)

data class PlaceLocation(
    val lat: Double? = null,
    val lng: Double? = null
)

data class AddressComponent(
    val long_name: String? = null,
    val short_name: String? = null,
    val types: List<String>? = null
)
