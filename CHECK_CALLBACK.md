# 🔍 Checking M-Pesa Callback Status

## How to Verify Callbacks Are Working

### 1. Check Backend Logs

When you make a payment, watch your backend terminal for these messages:

**If callback is received:**
```
═══════════════════════════════════════════════════════
📞 M-Pesa Callback received at: [timestamp]
═══════════════════════════════════════════════════════
Callback data: { ... }
```

**If payment is successful:**
```
💰 Payment details from callback:
   Receipt: [receipt number]
   Amount: [amount]
   Phone: [phone number]
✅ Transaction #X updated to completed
✅ Order #X status updated to 'confirmed'
```

### 2. Verify ngrok is Forwarding

1. Open ngrok web interface: http://localhost:4040
2. Check the "Requests" tab - you should see POST requests to `/api/mpesa/callback`
3. If you see requests, callbacks are reaching your server!

### 3. Test the Callback Endpoint

The callback endpoint should respond immediately. Test with:
```bash
curl -X POST http://localhost:5001/api/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
```

Should return: `{"ResultCode":0,"ResultDesc":"Callback received"}`

### 4. Common Issues

**No callbacks received:**
- ✅ ngrok is running? Check: `ps aux | grep ngrok`
- ✅ Backend is running on port 5001? Check: `lsof -ti:5001`
- ✅ ngrok URL matches `.env`? Check: `grep MPESA_CALLBACK_URL backend/.env`
- ✅ Payment was completed on phone? Check M-Pesa statement

**Callback received but status not updating:**
- Check backend logs for error messages
- Verify transaction exists in database
- Check if `ResultCode` in callback is `0` (success)

### 5. Manual Verification

If callbacks aren't working, use the manual confirmation button:
- Click "✅ I've Completed Payment - Confirm Now"
- Enter your M-Pesa receipt number
- This will update the status immediately






