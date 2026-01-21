# 📋 Deployment Changes Summary - January 19th, 2025

This document summarizes all changes being deployed to the dev environment.

## 🔐 PesaPal Integration

### Backend Changes
- **New Service**: `backend/services/pesapal.js`
  - PesaPal API 3.0 JSON integration
  - OAuth token management
  - IPN callback handling
  - Transaction status checking

- **New Routes**: `backend/routes/pesapal.js`
  - `POST /api/pesapal/initiate-payment` - Initiate card payment
  - `GET /api/pesapal/ipn` - Handle IPN callbacks
  - `GET /api/pesapal/transaction-status/:orderId` - Check payment status
  - `GET /api/pesapal/fix-order/:orderId` - Manual fix endpoint

- **New Routes**: `backend/routes/pdq-payment.js`
  - `POST /api/pdq-payment/process` - Process PDQ payments (admin)
  - `POST /api/pdq-payment/driver-process` - Process PDQ payments (driver)

### Frontend Changes
- **Customer Site** (`frontend/src/pages/Cart.js`):
  - Added "Card" payment method option
  - PesaPal iframe integration for secure payment form
  - Payment success handling and redirect

- **New Page**: `frontend/src/pages/PaymentSuccess.js`
  - Handles PesaPal callback redirects
  - Verifies payment status before redirecting

- **Updated**: `frontend/src/pages/OrderSuccess.js`
  - PesaPal payment polling and confirmation
  - Auto-login after successful payment

- **Admin Site** (`admin-frontend/src/components/NewOrderDialog.js`):
  - Added PesaPal card payment option for walk-in orders
  - Added PDQ payment option
  - Payment success display

- **Admin Transactions** (`admin-frontend/src/pages/Transactions.js`):
  - Added "Card Payments" tab
  - Filter transactions by payment method/provider

### Driver App
- **Updated**: `driver-app-native/app/src/main/kotlin/com/dialadrink/driver/ui/orders/OrderDetailActivity.kt`
  - Real-time payment status updates via Socket.IO
  - Displays "PAID" status for card payments

## 📱 Phone Number Normalization

### Backend Changes
- **Updated**: `backend/routes/orders.js`
  - Added `normalizePhoneForStorage()` function
  - Normalizes phone numbers to 254 format on order creation
  - Enhanced `/orders/find-all` endpoint with flexible phone matching:
    - Matches multiple phone variants (07..., 2547..., 7..., last 9 digits)
    - Uses OR conditions for comprehensive matching

- **Updated**: `backend/routes/auth.js`
  - Enhanced `/auth/check-pin-status` endpoint:
    - Robust phone lookup with multiple variants
    - Fallback to Orders table if customer not found
    - Improved logging for debugging

### Frontend Changes
- **Updated**: `frontend/src/pages/Cart.js`
  - Added `normalizePhoneForStorage()` function
  - Normalizes phone before sending to backend
  - Preserves existing customer data in localStorage

## 🔐 Customer Login Persistence

### Frontend Changes
- **Updated**: `frontend/src/contexts/CustomerContext.js`
  - Added localStorage sync across tabs/windows
  - Custom event dispatch for same-tab updates
  - Login validation (requires id, phone, or email)
  - Preserves customer data when updating with order info

- **Updated**: `frontend/src/pages/MyOrders.js`
  - Restores customer data from localStorage if context is empty
  - Ensures login persists across page refreshes

## ⚡ Real-Time Payment Status Updates

### Backend Changes
- **Updated**: `backend/routes/mpesa.js`
  - Enhanced `finalizeOrderPayment()` function:
    - Sets order status to 'confirmed' (or 'completed' for POS) on payment
    - Explicitly sets `paymentStatus: 'paid'` in Socket.IO payload
    - Improved logging for payment finalization

### Frontend Changes
- **Updated**: `admin-frontend/src/pages/Orders.js`
  - Enhanced `payment-confirmed` Socket.IO handler:
    - Explicitly calls `applyFilters()` after state update
    - Ensures UI updates immediately without refresh

- **Updated**: `driver-app-native/app/src/main/kotlin/com/dialadrink/driver/ui/orders/OrderDetailActivity.kt`
  - Enhanced `onPaymentConfirmed` socket handler:
    - Immediately updates UI with payment status
    - Reloads from API after short delay

## 📄 Pagination

### Frontend Changes
- **Updated**: `frontend/src/pages/MyOrders.js`
  - Added client-side pagination
  - `Pagination` component from MUI
  - Configurable rows per page (10, 25, 50, 100)

## 🗄️ Database Changes

### No New Migrations Required
- The `Transaction` model already has:
  - `paymentMethod` enum: 'card', 'mobile_money', 'cash', 'system'
  - `paymentProvider` string field (for 'mpesa', 'pesapal', etc.)
  - All required fields for PesaPal integration

## 🔧 Configuration Changes

### Environment Variables (Backend)
- `PESAPAL_CONSUMER_KEY` - PesaPal consumer key
- `PESAPAL_CONSUMER_SECRET` - PesaPal consumer secret
- `PESAPAL_ENVIRONMENT` - 'sandbox' or 'live'
- `CUSTOMER_FRONTEND_URL` - Customer site URL for redirects
- `NGROK_URL` - Optional, for local development IPN callbacks

### Driver App Configuration
- **Updated**: `driver-app-native/app/build.gradle`
  - Removed hardcoded ngrok URL
  - Defaults to dev backend URL
  - Uses environment variables for flexibility

- **Updated**: `driver-app-native/gradle.properties`
  - Updated default LOCAL_API_BASE_URL to dev backend

## 📊 API Endpoints

### New Endpoints
- `POST /api/pesapal/initiate-payment` - Initiate PesaPal payment
- `GET /api/pesapal/ipn` - PesaPal IPN callback handler
- `GET /api/pesapal/transaction-status/:orderId` - Check payment status
- `GET /api/pesapal/fix-order/:orderId` - Manual payment fix
- `POST /api/pdq-payment/process` - Process PDQ payment (admin)
- `POST /api/pdq-payment/driver-process` - Process PDQ payment (driver)

### Enhanced Endpoints
- `POST /api/orders/find-all` - Enhanced phone number matching
- `POST /api/auth/check-pin-status` - Enhanced customer lookup
- `POST /api/orders` - Phone number normalization on creation

## 🔗 PesaPal Dashboard Configuration

After deployment, configure in PesaPal dashboard:

**Website Domain:**
```
https://deliveryos-customer-910510650031.us-central1.run.app
```

**IPN Listener URL:**
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
```

## ✅ Verification Checklist

After deployment, verify:

- [ ] Backend health check: `curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/health`
- [ ] Customer site loads: `https://deliveryos-customer-910510650031.us-central1.run.app`
- [ ] Admin dashboard loads: `https://deliveryos-admin-910510650031.us-central1.run.app`
- [ ] Card payment option appears on checkout
- [ ] Phone numbers are normalized to 254 format
- [ ] Customer login persists across page refreshes
- [ ] Payment status updates in real-time (admin & driver)
- [ ] Orders pagination works on My Orders page
- [ ] PesaPal IPN callbacks are received (check backend logs)
