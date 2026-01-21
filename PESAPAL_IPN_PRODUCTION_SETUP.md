# 🔗 PesaPal IPN Production Setup

Since PesaPal only allows IPN configuration in the production credentials section, the code has been updated to **always use the production backend URL** for IPN callbacks.

## ✅ Configuration

The production IPN URL is hardcoded in the backend:
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
```

## 📋 PesaPal Dashboard Configuration

1. Go to: https://developer.pesapal.com/
2. Navigate to: **Settings > IPN Settings** (in the **Production** credentials section)
3. Add/Update IPN URL:
   ```
   https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
   ```
4. Set **IPN Notification Type**: `GET`
5. Save the configuration

## ✅ How It Works

- When you initiate a payment (even with sandbox credentials), the backend will:
  1. Register the IPN URL with PesaPal using the production URL
  2. PesaPal will send IPN callbacks to the production backend
  3. The production backend will process the IPN and update order status

## 🔍 Verification

### Check Backend Logs
When you start the backend or initiate a payment, you should see:
```
✅ Using production IPN callback URL (required for PesaPal): https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
✅ PesaPal IPN registered successfully. IPN ID: [ipn_id]
```

### Test IPN Endpoint
The production backend IPN endpoint should be accessible:
```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
```

## 📝 Important Notes

- **The IPN URL is now hardcoded to production** - no environment variable needed
- **Works with both sandbox and production credentials** - IPN always goes to production backend
- **Production backend must be running** - IPN callbacks will fail if production backend is down
- **Local development** - IPN callbacks will go to production, not local server

## 🐛 Troubleshooting

### IPN callbacks not received?

1. **Check production backend is running:**
   ```bash
   curl https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
   ```

2. **Check production backend logs** for IPN callbacks

3. **Verify PesaPal dashboard** has the correct IPN URL configured

4. **Check backend logs** when initiating payment - should show IPN registration
