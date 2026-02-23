# M-Pesa ResultCode 2028 Investigation

## Issue
**Order #6 Payment Rejection:**
- **ResultCode:** `2028`
- **ResultDesc:** `"The request is not permitted according to product assignment"`
- **CheckoutRequestID:** `ws_CO_20022026133819842727893741`
- **Timestamp:** 2026-02-20T10:38:29Z

## Key Finding
**Shortcode owner confirms:** These credentials work successfully in their other application for STK Push.

This means:
- ✅ Credentials are valid
- ✅ Shortcode is properly configured
- ❌ **Issue is with our application's request format or callback URL**

## Most Likely Causes

### 1. Callback URL Not Whitelisted (Most Likely)
**ResultCode 2028** often occurs when:
- The callback URL is not registered/whitelisted with M-Pesa for this specific application
- M-Pesa requires callback URLs to be pre-registered in the Developer Portal
- Different applications using the same shortcode need separate callback URL registrations

**Current Production Callback URL:**
```
https://deliveryos-production-backend-805803410802.us-central1.run.app/api/mpesa/callback
```

**Action Required:**
1. Log into M-Pesa Developer Portal (https://developer.safaricom.co.ke)
2. Go to: My Apps → Your App → STK Push → Callback URLs
3. Verify/Add: `https://deliveryos-production-backend-805803410802.us-central1.run.app/api/mpesa/callback`
4. Ensure it's whitelisted for production environment

### 2. Request Format Differences
Compare our request format with the working application:

**Our Current Format:**
```json
{
  "BusinessShortCode": "7861733",
  "Password": "[base64 encoded]",
  "Timestamp": "20260220103819",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 30,
  "PartyA": "254727893741",
  "PartyB": "7861733",
  "PhoneNumber": "254727893741",
  "CallBackURL": "https://deliveryos-production-backend-805803410802.us-central1.run.app/api/mpesa/callback",
  "AccountReference": "ORDER-6",
  "TransactionDesc": "Payment for Order #6"
}
```

**Things to Verify:**
- TransactionType: Should be `CustomerPayBillOnline` (not `CustomerBuyGoodsOnline`)
- AccountReference: Format might matter (some apps use specific formats)
- CallBackURL: Must be HTTPS and publicly accessible
- Password generation: Format must match exactly

### 3. Application-Specific Binding
M-Pesa might bind:
- Consumer Key → Specific Application
- Callback URL → Specific Application
- Shortcode → Multiple Applications (but each needs its own callback URL)

**Check:**
- Is the Consumer Key `hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr` bound to this specific application?
- Does the working application use the same Consumer Key or a different one?
- Are callback URLs registered per application or per shortcode?

## Comparison Checklist

Ask the shortcode owner to compare:

1. **Callback URL:**
   - What callback URL do they use in their working app?
   - Is it registered in M-Pesa Developer Portal?
   - Is it the same URL or different?

2. **Request Parameters:**
   - TransactionType: `CustomerPayBillOnline` or `CustomerBuyGoodsOnline`?
   - AccountReference format: What format do they use?
   - CallBackURL: Exact URL format

3. **Consumer Key:**
   - Do they use the same Consumer Key or a different one?
   - Is the Consumer Key app-specific?

4. **Password Generation:**
   - How do they generate the password?
   - Timestamp format: `YYYYMMDDHHmmss` (17 digits)?

## Immediate Action Items

1. **Register Callback URL in M-Pesa Developer Portal:**
   - URL: `https://deliveryos-production-backend-805803410802.us-central1.run.app/api/mpesa/callback`
   - Environment: Production
   - App: The app associated with Consumer Key `hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr`

2. **Verify Request Format:**
   - Compare our request with working application
   - Check TransactionType matches
   - Verify AccountReference format

3. **Test with Exact Same Parameters:**
   - Use same phone number, amount, and reference format as working app
   - Compare the exact request payload

## Code Verification

Our password generation:
```javascript
const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
// Result: "20260220103819" (17 digits: YYYYMMDDHHmmss)
const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
```

This should be correct, but verify with working application.

## Next Steps

1. ✅ **Immediate:** Register callback URL in M-Pesa Developer Portal
2. ✅ **Verify:** Compare request format with working application
3. ✅ **Test:** Retry STK Push after callback URL registration
4. ✅ **Monitor:** Check logs for ResultCode 2028 after fix
