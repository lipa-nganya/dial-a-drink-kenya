# Critical Fix: ngrok Port Mismatch

## Current Status
- ✅ Callback URL is correctly configured: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/mpesa/callback`
- ❌ **ngrok is forwarding to port 5000** 
- ✅ Backend is running on **port 5001**

## The Fix

### Step 1: Stop Current ngrok
The current ngrok process is forwarding to the wrong port. Stop it:
```bash
pkill -f "ngrok http"
```

### Step 2: Start ngrok with Correct Port
```bash
ngrok http 5001
```

**Important:** Make sure it says `Forwarding: https://homiest-psychopharmacologic-anaya.ngrok-free.dev -> http://localhost:5001`

### Step 3: Verify Backend is Running
```bash
curl http://localhost:5001/api/health
```
Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

### Step 4: Test via ngrok
```bash
curl -X POST https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"test": "data"}'
```

Should return: `{"ResultCode":0,"ResultDesc":"Callback received"}`

## After Fix
Once ngrok is forwarding to port 5001:
- ✅ M-Pesa callbacks will arrive successfully
- ✅ Receipt numbers will be saved automatically  
- ✅ Payment confirmation will work automatically

## Current Configuration
- Callback URL: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/mpesa/callback`
- Backend Port: `5001`
- ngrok Should Forward: `5001` (NOT 5000)





