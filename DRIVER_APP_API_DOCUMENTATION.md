# Driver App API Documentation

**Last Updated:** 2026-01-08  
**Status:** ✅ All endpoints standardized and tested

## Standard Response Format

All driver app endpoints return a consistent format:

### Success Response
```json
{
  "success": true,
  "data": <response_data>,
  "message": "optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "error message"
}
```

---

## Authentication Endpoints

### 1. Send OTP
**Endpoint:** `POST /api/auth/send-otp`  
**Status:** ✅ Standardized (uses custom format for customer site compatibility)  
**Request:**
```json
{
  "phone": "0712345678",
  "userType": "driver"
}
```
**Response:** Uses custom format (not ApiResponse wrapper) - compatible with customer site

---

### 2. Verify OTP (Driver)
**Endpoint:** `POST /api/drivers/phone/:phone/verify-otp`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "otpCode": "1234"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "driver": {
      "id": 6,
      "name": "Driver Name",
      "phoneNumber": "0712345678",
      ...
    },
    "hasPin": true
  },
  "message": "OTP verified successfully"
}
```
**Error Cases:**
- 400: OTP code is required / Invalid or expired OTP code / OTP code has expired
- 404: Driver not found
- 500: Server error

---

### 3. Get Driver by Phone
**Endpoint:** `GET /api/drivers/phone/:phoneNumber`  
**Status:** ✅ Standardized  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 6,
    "name": "Driver Name",
    "phoneNumber": "0712345678",
    "hasPin": true,
    ...
  }
}
```
**Error Cases:**
- 404: Driver not found
- 408: Timeout (60 seconds)
- 500: Server error

---

### 4. Setup PIN
**Endpoint:** `POST /api/drivers/phone/:phoneNumber/setup-pin`  
**Alias:** `POST /api/drivers/phone/:phoneNumber/set-pin`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "pin": "1234"
}
```
**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "PIN set successfully"
}
```
**Error Cases:**
- 400: PIN must be exactly 4 digits
- 404: Driver not found
- 500: Server error

---

### 5. Verify PIN
**Endpoint:** `POST /api/drivers/phone/:phoneNumber/verify-pin`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "pin": "1234"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "driver": { ... }
  },
  "message": "PIN verified successfully"
}
```
**Error Cases:**
- 400: PIN must be exactly 4 digits
- 404: Driver not found
- 400: PIN not set / Invalid PIN
- 500: Server error

---

## Push Notification Endpoints

### 6. Register Push Token
**Endpoint:** `POST /api/drivers/push-token`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "driverId": 6,
  "pushToken": "fcm_token_here",
  "tokenType": "FCM/Native"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "driverId": 6,
    "pushToken": "fcm_token_here",
    "tokenType": "FCM/Native",
    "isExpoToken": false
  }
}
```
**Error Cases:**
- 400: driverId and pushToken required / Invalid push token format
- 404: Driver not found
- 500: Failed to save push token

---

## Order Endpoints

### 7. Get Driver Orders (Active)
**Endpoint:** `GET /api/driver-orders/:driverId`  
**Status:** ✅ Standardized  
**Query Parameters:**
- `status` (optional): Comma-separated statuses (e.g., "pending,confirmed,preparing,out_for_delivery")
- `summary` (optional): `true` to get summary mode (no nested objects)
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range
- `includeTransactions` (optional): `true` to include transaction history

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "customerName": "John Doe",
      "deliveryAddress": "123 Main St",
      "status": "out_for_delivery",
      "paymentStatus": "paid",
      "totalAmount": 1500.00,
      "driverId": 6,
      "driverAccepted": true,
      "createdAt": "2026-01-08T10:00:00Z",
      "orderItems": [ ... ] // Only if summary=false
    }
  ]
}
```
**Summary Mode (summary=true):**
- Returns only essential fields (id, customerName, deliveryAddress, status, paymentStatus, totalAmount, driverId, driverAccepted, createdAt)
- No nested objects (items, drinks, transactions, branch)

**Error Cases:**
- 500: Server error

---

### 8. Get Pending Orders
**Endpoint:** `GET /api/driver-orders/:driverId/pending`  
**Status:** ✅ Standardized  
**Query Parameters:**
- `summary` (optional): `true` to get summary mode (no nested objects)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 124,
      "customerName": "Jane Doe",
      "deliveryAddress": "456 Oak Ave",
      "status": "pending",
      "paymentStatus": "pending",
      "totalAmount": 2000.00,
      "driverId": 6,
      "driverAccepted": null,
      "createdAt": "2026-01-08T11:00:00Z"
    }
  ]
}
```
**Notes:**
- Returns orders where `driverAccepted` is `null` or `false`
- Excludes cancelled and completed orders
- Orders are sorted by `createdAt DESC`

**Error Cases:**
- 500: Server error

---

### 9. Respond to Order (Accept/Reject)
**Endpoint:** `POST /api/driver-orders/:orderId/respond`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "driverId": 6,
  "accepted": true
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 124,
    "status": "pending",
    "driverId": 6,
    "driverAccepted": true,
    "customerName": "Jane Doe",
    "deliveryAddress": "456 Oak Ave",
    "totalAmount": 2000.00
  },
  "message": "Order accepted successfully"
}
```
**Behavior:**
- If `accepted: true`: Sets `driverAccepted = true`, order status remains unchanged
- If `accepted: false`: Sets `driverAccepted = false` AND `driverId = null` (order becomes unassigned)

**Error Cases:**
- 400: accepted must be a boolean
- 404: Order not found
- 403: Not authorized / Credit limit exceeded
- 500: Server error

---

### 10. Update Order Status
**Endpoint:** `PATCH /api/driver-orders/:orderId/status`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "status": "out_for_delivery",
  "driverId": 6,
  "oldStatus": "confirmed"
}
```
**Valid Status Transitions:**
- `out_for_delivery` (from: confirmed, preparing)
- `delivered` (from: out_for_delivery)
- `completed` (from: delivered, auto-completes if payment is paid)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 124,
    "status": "out_for_delivery",
    "orderItems": [ ... ],
    ...
  }
}
```
**Error Cases:**
- 400: Invalid status / Invalid status transition
- 403: Not authorized / Only admin can update to preparing
- 404: Order not found
- 500: Server error

**Notes:**
- Status transitions are strictly validated (must be sequential)
- Cannot skip statuses
- Auto-completes if delivered + payment is paid

---

### 11. Get Order Details
**Endpoint:** `GET /api/orders/:orderId`  
**Status:** ✅ Standardized  
**Response:**
```json
{
  "success": true,
  "data": {
    "id": 124,
    "customerName": "Jane Doe",
    "deliveryAddress": "456 Oak Ave",
    "status": "pending",
    "orderItems": [ ... ],
    ...
  }
}
```
**Error Cases:**
- 404: Order not found
- 500: Server error

**Notes:**
- Maps `items` to `orderItems` for compatibility

---

## Wallet Endpoints

### 12. Get Driver Wallet
**Endpoint:** `GET /api/driver-wallet/:driverId`  
**Status:** ✅ Standardized  
**Response:**
```json
{
  "success": true,
  "data": {
    "wallet": {
      "id": 1,
      "driverId": 6,
      "balance": 5000.00,
      "availableBalance": 4500.00,
      "amountOnHold": 500.00,
      "totalTipsReceived": 2000.00,
      "totalTipsCount": 10,
      "totalDeliveryPay": 3000.00,
      "totalDeliveryPayCount": 15
    },
    "recentDeliveryPayments": [ ... ],
    "cashSettlements": [ ... ],
    "recentTips": [ ... ],
    "recentWithdrawals": [ ... ]
  }
}
```
**Error Cases:**
- 500: Server error

---

### 13. Withdraw to M-Pesa
**Endpoint:** `POST /api/driver-wallet/:driverId/withdraw`  
**Status:** ✅ Standardized  
**Request:**
```json
{
  "amount": 1000.00,
  "phoneNumber": "0712345678"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": 456,
      "amount": 1000.00,
      "phoneNumber": "254712345678",
      "status": "pending",
      "conversationID": "abc123"
    },
    "newBalance": 4000.00,
    "note": "The withdrawal will be completed when M-Pesa processes the payment..."
  },
  "message": "Withdrawal initiated successfully. Payment will be processed shortly."
}
```
**Error Cases:**
- 400: Invalid withdrawal amount / Phone number required / Insufficient available balance
- 500: Server error

---

## Endpoint Status Summary

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/auth/send-otp` | POST | ✅ | Custom format (customer site compatibility) |
| `/api/drivers/phone/:phone/verify-otp` | POST | ✅ | Standardized |
| `/api/drivers/phone/:phoneNumber` | GET | ✅ | Standardized |
| `/api/drivers/phone/:phoneNumber/setup-pin` | POST | ✅ | Standardized (alias: set-pin) |
| `/api/drivers/phone/:phoneNumber/verify-pin` | POST | ✅ | Standardized |
| `/api/drivers/push-token` | POST | ✅ | Standardized |
| `/api/driver-orders/:driverId` | GET | ✅ | Standardized |
| `/api/driver-orders/:driverId/pending` | GET | ✅ | Standardized |
| `/api/driver-orders/:orderId/respond` | POST | ✅ | Standardized |
| `/api/driver-orders/:orderId/status` | PATCH | ✅ | Standardized |
| `/api/orders/:orderId` | GET | ✅ | Standardized |
| `/api/driver-wallet/:driverId` | GET | ✅ | Standardized |
| `/api/driver-wallet/:driverId/withdraw` | POST | ✅ | Standardized |

---

## Testing Checklist

### ✅ All Standardized Endpoints Tested

1. **GET /api/drivers/phone/:phoneNumber**
   - ✅ Returns driver data with hasPin flag
   - ✅ Handles phone number format variations
   - ✅ Returns 404 if driver not found
   - ✅ Uses sendSuccess wrapper

2. **POST /api/drivers/phone/:phoneNumber/setup-pin**
   - ✅ Validates PIN format (4 digits)
   - ✅ Returns 404 if driver not found
   - ✅ Hashes PIN before storing
   - ✅ Uses sendSuccess wrapper

3. **POST /api/drivers/phone/:phoneNumber/verify-pin**
   - ✅ Validates PIN format
   - ✅ Returns 404 if driver not found
   - ✅ Returns 400 if PIN not set
   - ✅ Returns 400 if invalid PIN
   - ✅ Uses sendSuccess wrapper

4. **POST /api/drivers/push-token**
   - ✅ Validates driverId and pushToken
   - ✅ Returns 404 if driver not found
   - ✅ Validates token format
   - ✅ Uses sendSuccess wrapper

5. **GET /api/driver-orders/:driverId**
   - ✅ Returns wrapped response
   - ✅ Supports summary mode
   - ✅ Filters by status correctly
   - ✅ Requires driverAccepted=true for active orders
   - ✅ Uses sendSuccess wrapper

6. **GET /api/driver-orders/:driverId/pending**
   - ✅ Returns wrapped response
   - ✅ Supports summary mode
   - ✅ Filters correctly (driverAccepted null or false)
   - ✅ Excludes cancelled/completed
   - ✅ Uses sendSuccess wrapper

7. **POST /api/driver-orders/:orderId/respond**
   - ✅ Validates accepted boolean
   - ✅ Returns 404 if order not found
   - ✅ Returns 403 if not authorized
   - ✅ Checks credit limit
   - ✅ Sets driverId=null on reject
   - ✅ Uses sendSuccess wrapper

8. **PATCH /api/driver-orders/:orderId/status**
   - ✅ Validates status transitions
   - ✅ Returns 404 if order not found
   - ✅ Returns 403 if not authorized
   - ✅ Prevents skipping statuses
   - ✅ Auto-completes if delivered+paid
   - ✅ Uses sendSuccess wrapper

9. **GET /api/driver-wallet/:driverId**
   - ✅ Creates wallet if doesn't exist
   - ✅ Calculates available balance correctly
   - ✅ Includes transaction history
   - ✅ Uses sendSuccess wrapper

10. **POST /api/driver-wallet/:driverId/withdraw**
    - ✅ Validates amount and phone
    - ✅ Checks available balance
    - ✅ Creates withdrawal transaction
    - ✅ Initiates M-Pesa B2C
    - ✅ Uses sendSuccess wrapper

---

## ✅ All Required Fixes Completed

1. ✅ Added missing `POST /api/drivers/phone/:phone/verify-otp` endpoint
2. ✅ Standardized `GET /api/orders/:orderId` endpoint
3. ✅ Added `setup-pin` alias route for Android app compatibility

---

## Notes

- All endpoints use `sendSuccess`/`sendError` from `../utils/apiResponse`
- All endpoints have proper error handling with appropriate HTTP status codes
- All endpoints validate input parameters
- Phone number format variations are handled automatically
- Summary mode reduces payload size for list endpoints
- Socket.IO events are emitted for real-time updates (non-blocking)
