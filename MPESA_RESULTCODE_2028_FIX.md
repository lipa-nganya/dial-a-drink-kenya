# M-Pesa ResultCode 2028 - Payment Rejection Fix

## Issue Identified

**Order #6 Payment Rejection:**
- **ResultCode:** `2028`
- **ResultDesc:** `"The request is not permitted according to product assignment"`
- **CheckoutRequestID:** `ws_CO_20022026133819842727893741`
- **Timestamp:** 2026-02-20T10:38:29Z

## Root Cause

**ResultCode 2028** indicates an **M-Pesa configuration issue**, NOT a customer problem. This error means:

1. **STK Push is not enabled** for the M-Pesa shortcode
2. **Product assignment mismatch** - The shortcode may be configured for a different product type
3. **Business shortcode not activated** for `CustomerPayBillOnline` transaction type
4. **Shortcode permissions** - The shortcode doesn't have permission to initiate STK Push

## Current Configuration

From the deployment, the production M-Pesa credentials are:
- **Shortcode:** `7861733`
- **Environment:** `production`
- **Transaction Type:** `CustomerPayBillOnline`

## Solution Steps

### 1. Verify M-Pesa Dashboard Configuration

Log into the M-Pesa Developer Portal (https://developer.safaricom.co.ke) and check:

1. **Go to:** My Apps → Your App → STK Push
2. **Verify:**
   - STK Push is enabled for shortcode `7861733`
   - Product type matches (should be "PayBill" or "Buy Goods")
   - Shortcode is active and not suspended
   - API credentials match what's deployed

### 2. Check Shortcode Product Assignment

The shortcode `7861733` must be assigned to:
- **Product Type:** PayBill (for CustomerPayBillOnline)
- **STK Push:** Enabled
- **Status:** Active

### 3. Verify API Credentials

Ensure the production credentials match:
- Consumer Key: `hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr`
- Consumer Secret: `IYFIJvfjSsHHqTyU`
- Shortcode: `7861733`
- Passkey: `bfb205c2a0b53eb1685038322a8d6ae95abc2d63245eba38e96cc5fe45c84065`

### 4. Contact M-Pesa Support

If the configuration looks correct, contact M-Pesa support to:
- Verify shortcode `7861733` is activated for STK Push
- Confirm product assignment is correct
- Check if there are any restrictions on the shortcode

## Temporary Workaround

Until the M-Pesa configuration is fixed:
1. Use alternative payment methods (PesaPal, Cash on Delivery)
2. Manually mark orders as paid if payment was received via other means
3. Retry STK Push after M-Pesa configuration is corrected

## Verification

After fixing the M-Pesa configuration, test with a small amount:
```bash
# Test STK Push initiation
curl -X POST https://deliveryos-production-backend-805803410802.us-central1.run.app/api/mpesa/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254712345678",
    "amount": 10,
    "orderId": 999,
    "accountReference": "TEST"
  }'
```

If successful, you should receive `ResponseCode: 0` and a `CheckoutRequestID`.

## Next Steps

1. ✅ **Immediate:** Contact M-Pesa support to verify shortcode configuration
2. ✅ **Verify:** Check M-Pesa Developer Portal for STK Push settings
3. ✅ **Test:** After configuration fix, test with a small transaction
4. ✅ **Monitor:** Watch logs for ResultCode 2028 errors

## Related Files

- `backend/services/mpesa.js` - M-Pesa STK Push implementation
- `backend/routes/mpesa.js` - M-Pesa callback handler
- `deploy-to-production-complete.sh` - Production credentials configuration
