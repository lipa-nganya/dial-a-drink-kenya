# Fix ngrok Configuration

## Problem Found
ngrok is currently forwarding to port **80**, but your backend runs on port **5001**. This causes 502 Bad Gateway errors.

## Solution

### Step 1: Stop Current ngrok
```bash
pkill -f "ngrok http"
```

### Step 2: Start ngrok with Correct Port
```bash
ngrok http 5001
```

### Step 3: Update .env File
Add to `backend/.env`:
```
MPESA_CALLBACK_URL=https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/mpesa/callback
NGROK_URL=https://homiest-psychopharmacologic-anaya.ngrok-free.dev
```

**Note:** If your ngrok URL changes, update the `MPESA_CALLBACK_URL` accordingly.

### Step 4: Verify ngrok is Forwarding Correctly
Check ngrok dashboard: http://localhost:4040

You should see:
- Forwarding: `https://your-ngrok-url.ngrok-free.dev` -> `http://localhost:5001`

### Step 5: Test the Callback
```bash
curl -X POST https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

This should return: `{"ResultCode":0,"ResultDesc":"Callback received"}`

### Step 6: Restart Backend (if needed)
```bash
cd backend
npm start
```

## After Fix
Once ngrok is forwarding to port 5001 correctly:
1. M-Pesa callbacks will arrive successfully
2. Receipt numbers will be saved
3. Payment confirmation will work automatically





