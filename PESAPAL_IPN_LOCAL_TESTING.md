# 🔗 PesaPal IPN Setup for Local Testing

Since you're testing in sandbox and local, but PesaPal only allows IPN configuration in the production credentials section, here's how to set it up:

## ✅ Option 1: Use ngrok for Local Testing (Recommended)

### Step 1: Start ngrok

```bash
ngrok http 5001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### Step 2: Update Backend Environment

Add to `backend/.env.local`:

```env
NGROK_URL=https://abc123.ngrok-free.app
```

### Step 3: Configure PesaPal Dashboard

Even though you're using **sandbox credentials**, you must configure the IPN in the **Production credentials section**:

1. Go to: https://developer.pesapal.com/
2. Navigate to: **Settings > IPN Settings** (in the **Production** credentials section)
3. Add/Update IPN URL:
   ```
   https://abc123.ngrok-free.app/api/pesapal/ipn
   ```
   (Use your actual ngrok URL)
4. Set **IPN Notification Type**: `GET`
5. Save the configuration

### Step 4: Restart Backend

```bash
cd backend
npm run dev
```

Check logs for:
```
✅ Using ngrok URL for IPN callbacks (local development): https://abc123.ngrok-free.app/api/pesapal/ipn
```

## ✅ Option 2: Use Production Backend IPN URL

If you don't want to use ngrok, the code will automatically use the production backend IPN URL:

```
https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
```

**Note:** With this option, IPN callbacks will go to the production backend, which will update orders in the production database. This is fine if you're testing with production data, but not ideal for local development.

### Configure PesaPal Dashboard

1. Go to: https://developer.pesapal.com/
2. Navigate to: **Settings > IPN Settings** (in the **Production** credentials section)
3. Add/Update IPN URL:
   ```
   https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api/pesapal/ipn
   ```
4. Set **IPN Notification Type**: `GET`
5. Save the configuration

## 🔍 How It Works

The code checks in this order:
1. **PESAPAL_IPN_CALLBACK_URL** environment variable (if set)
2. **NGROK_URL** environment variable (if set) - appends `/api/pesapal/ipn`
3. **Production IPN URL** (fallback)

## ✅ Verification

### Check Backend Logs
When you start the backend or initiate a payment, you should see:
```
✅ Using ngrok URL for IPN callbacks (local development): https://...
✅ PesaPal IPN registered successfully. IPN ID: [ipn_id]
```

### Test IPN Endpoint
Visit in your browser:
```
https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn
```

You should see an error about missing `OrderTrackingId` (this is expected - it means the endpoint is accessible).

## 🔄 Important Notes

- **Free ngrok URLs change** - Update both `.env.local` and PesaPal dashboard when ngrok restarts
- **Keep ngrok running** while testing - if it stops, IPN callbacks won't work
- **PesaPal dashboard** - Even with sandbox credentials, configure IPN in Production section
- **Local database** - With ngrok, IPN callbacks update your local database

## 🐛 Troubleshooting

### IPN callbacks not received?

1. **Check ngrok is running:**
   ```bash
   curl http://localhost:4040/api/tunnels
   ```

2. **Check backend logs** for the IPN callback URL being used

3. **Verify PesaPal dashboard** has the correct IPN URL (in Production section)

4. **Test the IPN endpoint:**
   ```bash
   curl "https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn?OrderTrackingId=test"
   ```

### Backend using production URL instead of ngrok?

- Make sure `NGROK_URL` is set in `backend/.env.local`
- Restart the backend after adding the environment variable
- Check backend logs to see which URL is being used
