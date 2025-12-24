# M-Pesa Payment Confirmation Diagnostic

## Current Issue
- Payment is successful (user enters PIN, payment completes)
- But status remains "pending" 
- No receipt number saved in database
- This means **M-Pesa callback is NOT arriving** at your local server

## Root Cause
The callback URL configured in M-Pesa STK push is pointing to the **production server** (`https://dialadrink-backend-910510650031.us-central1.run.app/api/mpesa/callback`) instead of your local ngrok URL.

## Solution

### Step 1: Check Current Callback URL
```bash
curl http://localhost:5001/api/mpesa/callback-url
```

### Step 2: Set ngrok URL in Environment
Add to `backend/.env`:
```
MPESA_CALLBACK_URL=https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/mpesa/callback
NGROK_URL=https://homiest-psychopharmacologic-anaya.ngrok-free.dev
```

### Step 3: Verify ngrok is Running
```bash
# Check if ngrok is running
curl http://localhost:4040/api/tunnels

# Or check ngrok dashboard
open http://localhost:4040
```

### Step 4: Restart Backend Server
After updating `.env`, restart the backend:
```bash
cd backend
npm start
```

### Step 5: Test Callback URL
```bash
# This should return your ngrok URL
curl http://localhost:5001/api/mpesa/callback-url
```

### Step 6: Check Recent Transactions
```bash
# See if any transactions have receipt numbers (callbacks received)
curl http://localhost:5001/api/mpesa/callback-log
```

## Manual Test
If callbacks still don't arrive, you can manually confirm payment using the admin panel "Verify Payment" button, or use the test callback endpoint (only in development).

## Next Steps
1. Verify ngrok tunnel is active and forwarding to port 5001
2. Update `.env` with correct callback URL
3. Restart backend server
4. Make a test payment
5. Check backend logs for callback receipt: `tail -f /tmp/backend.log | grep -i callback`

























