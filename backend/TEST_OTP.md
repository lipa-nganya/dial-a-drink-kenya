# Testing OTP Sending

## Test OTP Endpoint

```bash
# Test with a phone number
curl -X POST http://localhost:5001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"254712345678"}'
```

## Check Backend Logs

The backend will now log detailed information about:
- API URL being used
- Payload being sent
- API response received
- Any errors

## Common Issues

### 1. API Credentials Not Set
Check `.env` file has:
```
ADVANTA_API_KEY=your_api_key
ADVANTA_PARTNER_ID=your_partner_id
ADVANTA_SENDER_ID=your_sender_id
ADVANTA_API_URL=https://quicksms.advantasms.com
```

### 2. Invalid Phone Number Format
- Must be in format: 254712345678
- Or: 0712345678 (will be converted)

### 3. API Response Issues
Check backend logs for:
- Response status codes
- Error messages from Advanta API
- Network timeouts

### 4. Rate Limiting
Advanta API may have rate limits. Check error messages.

## Debugging Steps

1. **Check backend is running:**
   ```bash
   curl http://localhost:5001/api/health
   ```

2. **Test OTP endpoint:**
   ```bash
   curl -X POST http://localhost:5001/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone":"254712345678"}'
   ```

3. **Check backend logs:**
   ```bash
   tail -f /tmp/backend.log
   ```

4. **Verify environment variables:**
   ```bash
   cd backend
   grep ADVANTA .env
   ```

## Expected Response

Success:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresAt": "2025-11-04T..."
}
```

Error:
```json
{
  "success": false,
  "error": "Error message from API"
}
```

























