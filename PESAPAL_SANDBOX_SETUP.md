# PesaPal Sandbox Setup for Dev Environment

## ✅ Configuration Complete

**Date**: January 2026  
**Environment**: Sandbox (Dev)  
**Backend URL**: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app`  
**Frontend URL**: `https://dialadrink.thewolfgang.tech`

## 🔑 Credentials Configured

- **Consumer Key**: `qkio1BGGYAXTu2JOfm7XSXNruoZsrqEW`
- **Consumer Secret**: `osGQ364R49cXKeOYSpaOnT++rHs=`
- **Environment**: `sandbox`
- **Base URL**: `https://cybqa.pesapal.com/pesapalv3` (Sandbox)

## 🔗 URLs Configured

### IPN Callback URL
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
```

**⚠️ IMPORTANT**: Even though we're using sandbox credentials, you must configure the IPN URL in the **Production credentials section** of the PesaPal dashboard. This is a PesaPal requirement.

### Website URL
```
https://dialadrink.thewolfgang.tech
```

### Callback URLs (Auto-generated)
- **Success**: `https://dialadrink.thewolfgang.tech/payment-success?orderId={orderId}`
- **Cancellation**: `https://dialadrink.thewolfgang.tech/payment-cancelled?orderId={orderId}`

## 📋 PesaPal Dashboard Configuration

### Step 1: Configure IPN URL

1. Log in to PesaPal Dashboard: https://developer.pesapal.com/
2. Go to **Credentials** → **Production** (even for sandbox testing)
3. Scroll to **IPN (Instant Payment Notification)**
4. Add IPN URL: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn`
5. Save changes

### Step 2: Configure Website URL

1. In the same **Production** credentials section
2. Set **Website URL**: `https://dialadrink.thewolfgang.tech`
3. Save changes

## 💳 Payment Flow

The card payment flow matches the local payment flow:

### 1. Order Creation
- Customer fills cart and checkout form
- Selects "Card" as payment method
- Submits order → Backend creates order with `paymentMethod: 'card'`

### 2. Payment Initiation
- Frontend calls `/api/pesapal/initiate-payment` with:
  - `orderId`
  - `callbackUrl` (auto-generated: `/payment-success?orderId={orderId}`)
  - `cancellationUrl` (auto-generated: `/payment-cancelled?orderId={orderId}`)
- Backend:
  - Gets PesaPal access token
  - Registers IPN (if not already registered)
  - Submits order to PesaPal
  - Returns `redirectUrl` for payment form

### 3. Payment Form
- Frontend loads PesaPal payment form in iframe
- Customer enters card details on PesaPal's secure page
- Customer completes payment

### 4. Payment Callback
- PesaPal redirects to: `/payment-success?orderId={orderId}`
- Frontend checks payment status via `/api/pesapal/transaction-status/{orderId}`
- If confirmed, redirects to `/order-success`

### 5. IPN Notification
- PesaPal sends IPN to: `/api/pesapal/ipn`
- Backend:
  - Verifies IPN signature
  - Updates transaction status
  - Finalizes order payment
  - Updates order status

## 🧪 Testing

### Test Card Details (Sandbox)

Use these test cards from PesaPal sandbox:
- **Visa**: `4111111111111111`
- **Mastercard**: `5555555555554444`
- **Expiry**: Any future date (e.g., `12/25`)
- **CVV**: Any 3 digits (e.g., `123`)
- **Name**: Any name

### Test Flow

1. **Create Order**:
   - Visit: https://dialadrink.thewolfgang.tech
   - Add items to cart
   - Fill checkout form
   - Select "Card" payment
   - Submit order

2. **Complete Payment**:
   - PesaPal iframe should load
   - Enter test card details
   - Complete payment

3. **Verify**:
   - Should redirect to `/payment-success`
   - Then redirect to `/order-success`
   - Order should show as "paid" in admin dashboard

### Monitor IPN Callbacks

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend AND textPayload=~'pesapal'" \
  --limit 50 \
  --format="table(timestamp,textPayload)" \
  --project drink-suite
```

## 🔍 Troubleshooting

### Payment Not Initiating

1. **Check credentials**:
   ```bash
   gcloud run services describe deliveryos-backend \
     --region us-central1 \
     --format="get(spec.template.spec.containers[0].env)" \
     --project drink-suite | grep PESAPAL
   ```

2. **Check backend logs** for PesaPal errors:
   ```bash
   gcloud logging read \
     "resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-backend" \
     --limit 20 \
     --format="table(timestamp,textPayload)" \
     --project drink-suite | grep -i "pesapal\|error"
   ```

### IPN Not Received

1. **Verify IPN URL** is configured in PesaPal dashboard (Production section)
2. **Check IPN endpoint** is accessible:
   ```bash
   curl -X POST https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
   ```
3. **Check logs** for IPN callbacks (see command above)

### Payment Status Not Updating

1. Check if IPN was received (see logs)
2. Verify transaction status endpoint:
   ```bash
   curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/transaction-status/{orderId}
   ```

## 🔄 Updating Credentials

To update PesaPal credentials, run:

```bash
./setup-pesapal-sandbox.sh
```

Or manually update environment variables:

```bash
gcloud run services update deliveryos-backend \
  --region us-central1 \
  --project drink-suite \
  --update-env-vars "PESAPAL_CONSUMER_KEY=your_key,PESAPAL_CONSUMER_SECRET=your_secret"
```

## 📝 Notes

- **Sandbox vs Production**: Even with sandbox credentials, IPN must be configured in Production section
- **IPN Registration**: Backend automatically registers IPN on first payment initiation
- **Payment Flow**: Matches local development flow exactly
- **Environment Variables**: All configured via Cloud Run service settings

---

**Last Updated**: January 2026  
**Maintained By**: Development Team
