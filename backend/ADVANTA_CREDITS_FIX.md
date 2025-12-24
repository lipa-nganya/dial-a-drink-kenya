# Advanta SMS Credits Issue - Fix Guide

## Problem

OTP is not being received because the Advanta SMS account has **insufficient credits**.

**Error from logs:**
```
Low credit units to send message, Current balance 0.00, Required 1
Status Code: 402
```

## Solution

### Step 1: Top Up Advanta Account

1. **Login to Advanta SMS Dashboard:**
   - Go to: https://quicksms.advantasms.com
   - Login with your credentials

2. **Check Current Balance:**
   - Navigate to Account/Balance section
   - Verify current balance is 0.00

3. **Top Up Credits:**
   - Go to "Top Up" or "Add Credits" section
   - Purchase SMS credits (minimum usually 1 credit per SMS)
   - Complete payment

4. **Verify Balance:**
   - Check that balance is updated
   - Should show enough credits to send messages

### Step 2: Test OTP Sending

After topping up, test OTP sending:

```bash
curl -X POST http://localhost:5001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"254712345678"}'
```

### Step 3: Monitor Backend Logs

Check backend logs to confirm SMS is being sent:

```bash
tail -f /tmp/backend.log | grep -i "otp\|advanta"
```

## Current Configuration

The backend is configured with:
- **API Key**: Set in `.env` as `ADVANTA_API_KEY`
- **Partner ID**: Set in `.env` as `ADVANTA_PARTNER_ID`
- **Sender ID**: Set in `.env` as `ADVANTA_SENDER_ID`
- **API URL**: `https://quicksms.advantasms.com`

## Error Handling

The backend now:
- ✅ Detects 402 (insufficient credits) errors
- ✅ Provides clear error messages
- ✅ Still generates OTP (stored in database)
- ✅ Logs detailed error information

## Temporary Workaround

For testing purposes, you can:
1. Check backend logs for generated OTP code
2. Use that OTP code to verify login
3. OTP is stored in database with 3-hour expiry

## Verify Credits

To check your Advanta account balance, you can:

1. **Login to Advanta Dashboard**
2. **Check Account Balance**
3. **Or use API** (if Advanta provides balance check endpoint)

## After Top Up

Once credits are added:
1. Restart backend server (if needed)
2. Test OTP sending
3. Verify SMS delivery
4. OTPs should now be received successfully

## Important Notes

- **OTP is always generated** even if SMS fails
- **OTP is stored in database** for 3 hours
- **For testing**, you can check backend logs for OTP code
- **For production**, ensure credits are always available

## Monitoring

Check backend logs regularly for:
- `✅ OTP sent successfully` - SMS sent
- `❌ OTP failed` - SMS failed (check error)
- `402` status code - Insufficient credits

## Contact Advanta Support

If you need help with:
- Account setup
- Credit purchase
- API issues

Contact: https://advantasms.com/contact or their support portal

























