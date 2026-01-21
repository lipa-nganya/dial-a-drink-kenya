# 🔗 PesaPal IPN Setup Guide

This guide ensures ngrok is running and the PesaPal IPN callback URL is correctly configured.

## ✅ Quick Setup

Run the automated script:

```bash
chmod +x ensure-ngrok-pesapal.sh
./ensure-ngrok-pesapal.sh
```

This script will:
1. ✅ Check if ngrok is running (start it if not)
2. ✅ Get the current ngrok URL
3. ✅ Update `backend/.env.local` with `NGROK_URL` and `PESAPAL_IPN_CALLBACK_URL`
4. ✅ Provide the exact IPN URL to configure in PesaPal dashboard

## 📋 Manual Setup (if script doesn't work)

### Step 1: Start ngrok

In a new terminal, run:

```bash
ngrok http 5001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### Step 2: Update Backend Environment

Add or update these lines in `backend/.env.local`:

```env
NGROK_URL=https://your-ngrok-url.ngrok-free.app
PESAPAL_IPN_CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn
```

Replace `your-ngrok-url.ngrok-free.app` with your actual ngrok URL.

### Step 3: Restart Backend

```bash
cd backend
npm run dev
```

Check the logs for:
```
✅ Using IPN callback URL from environment: https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn
```

### Step 4: Configure PesaPal Dashboard

1. Go to: https://developer.pesapal.com/
2. Navigate to: **Settings > IPN Settings** (or **Merchant IPN Settings**)
3. Add/Update IPN URL:
   ```
   https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn
   ```
4. Set **IPN Notification Type**: `GET`
5. Save the configuration

## ✅ Verification

### Check 1: Backend Logs
When you start the backend, you should see:
```
✅ Using IPN callback URL from environment: https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn
```

### Check 2: Test IPN Endpoint
Visit in your browser:
```
https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn
```

You should see an error about missing `OrderTrackingId` (this is expected - it means the endpoint is accessible).

### Check 3: Backend Logs During Payment
When a payment is completed, you should see:
```
📥📥📥 PesaPal IPN CALLBACK RECEIVED: [timestamp]
```

## 🔄 Important Notes

- **Free ngrok URLs change every time you restart ngrok** - you'll need to:
  1. Update `backend/.env.local` with the new URL
  2. Restart the backend
  3. Update the PesaPal dashboard with the new URL

- **Keep ngrok running** while testing - if it stops, IPN callbacks won't work

- **For production**, use the production IPN URL (configured automatically)

## 🐛 Troubleshooting

### IPN callbacks not received?

1. **Check ngrok is running:**
   ```bash
   curl http://localhost:4040/api/tunnels
   ```

2. **Check backend logs** for the IPN callback URL being used

3. **Verify PesaPal dashboard** has the correct IPN URL

4. **Test the IPN endpoint** directly:
   ```bash
   curl "https://your-ngrok-url.ngrok-free.app/api/pesapal/ipn?OrderTrackingId=test"
   ```

### ngrok URL not accessible?

- Make sure ngrok is running
- Check that your backend is running on port 5001
- Verify the ngrok URL in your browser

### Want a stable URL?

- Upgrade to ngrok paid plan for static domains
- Or use a service like Cloudflare Tunnel

## 📞 Current Configuration

After running the setup script, you'll see output like:

```
═══════════════════════════════════════════════════════
📋 PesaPal IPN Configuration
═══════════════════════════════════════════════════════
✅ ngrok URL: https://abc123.ngrok-free.app
✅ IPN Callback URL: https://abc123.ngrok-free.app/api/pesapal/ipn
═══════════════════════════════════════════════════════
```

Use the **IPN Callback URL** in the PesaPal dashboard.
