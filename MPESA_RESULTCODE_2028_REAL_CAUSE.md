# M-Pesa ResultCode 2028 - Real Cause Analysis

## Important Clarification

**ChatGPT Confirmation:**
- ✅ STK Push callback URLs are **NOT** registered in Developer Portal UI
- ✅ Callback URL is included in the request payload (we're already doing this correctly)
- ✅ Safaricom automatically sends results to the URL in the request

**Therefore:** ResultCode 2028 is **NOT** about callback URL registration!

## Real Causes of ResultCode 2028

Since the callback URL is correctly included in our request, ResultCode 2028 "request is not permitted according to product assignment" indicates:

### 1. Consumer Key Authorization Issue (Most Likely)
- The Consumer Key `hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr` might not be authorized for shortcode `7861733`
- Each Consumer Key is typically bound to a specific application
- If the owner's working app uses a different Consumer Key, we need the correct one for this app

**Action:** Ask shortcode owner:
- What Consumer Key do they use in their working application?
- Is it the same as `hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr` or different?
- Do they have separate Consumer Keys for different applications?

### 2. Product Assignment Mismatch
- Shortcode `7861733` might be configured as "Buy Goods" but we're using `CustomerPayBillOnline`
- Or vice versa - configured as "PayBill" but wrong transaction type

**Our Current Request:**
```json
{
  "TransactionType": "CustomerPayBillOnline",  // For PayBill
  "BusinessShortCode": "7861733"
}
```

**Possible Issues:**
- If shortcode is "Buy Goods", should use `CustomerBuyGoodsOnline`
- If shortcode is "PayBill", `CustomerPayBillOnline` is correct

**Action:** Verify with shortcode owner:
- What product type is shortcode `7861733`? (PayBill or Buy Goods)
- What TransactionType do they use in their working app?

### 3. Shortcode Restrictions
- The shortcode might have restrictions on which Consumer Keys can use it
- Multiple applications might need separate Consumer Keys even for the same shortcode

### 4. Request Format Differences
Compare our exact request format with the working application:

**Our Format:**
```json
{
  "BusinessShortCode": "7861733",
  "Password": "[base64(Shortcode+Passkey+Timestamp)]",
  "Timestamp": "YYYYMMDDHHmmss",
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
- Is `PartyB` the same as `BusinessShortCode`? (We're using shortcode for both)
- Is `AccountReference` format correct?
- Is `TransactionDesc` required or optional?

## Investigation Checklist

Ask the shortcode owner to provide:

1. **Consumer Key:**
   - [ ] What Consumer Key do they use?
   - [ ] Is it the same as ours or different?
   - [ ] Do they have separate Consumer Keys per application?

2. **Product Type:**
   - [ ] What product type is shortcode `7861733`? (PayBill/Buy Goods)
   - [ ] What TransactionType do they use? (`CustomerPayBillOnline` or `CustomerBuyGoodsOnline`)

3. **Request Format:**
   - [ ] Can they share an example of their working STK Push request?
   - [ ] What values do they use for `PartyB`?
   - [ ] What format for `AccountReference`?

4. **Shortcode Configuration:**
   - [ ] Is the shortcode configured for multiple applications?
   - [ ] Do different apps need different Consumer Keys?

## Most Likely Solution

Based on the error and the fact that credentials work in another app:

**The Consumer Key `hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr` is likely not authorized for this specific application.**

**Solution:**
1. Get the correct Consumer Key for this application from the shortcode owner
2. Or request a new Consumer Key/Secret pair for this application
3. Update the production environment variables with the correct credentials

## Next Steps

1. ✅ **Immediate:** Contact shortcode owner to verify Consumer Key
2. ✅ **Verify:** Check if they use the same Consumer Key or a different one
3. ✅ **Update:** If different, update production credentials
4. ✅ **Test:** Retry STK Push with correct Consumer Key
