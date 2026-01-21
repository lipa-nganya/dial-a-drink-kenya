# Debug Connection Issues

## Verify Local Backend Connection

### 1. Check Backend is Running
```bash
curl http://localhost:5001/api/health
```
Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

### 2. Check ngrok is Running
```bash
ps aux | grep ngrok
```
Should show: `ngrok http 5001`

### 3. Test ngrok URL
```bash
curl -H "ngrok-skip-browser-warning: true" \
  https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/health
```
Should return the same health check response.

### 4. Test Driver Lookup
```bash
# Replace with actual driver phone number from your database
curl -H "ngrok-skip-browser-warning: true" \
  "https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/drivers/phone/254712345678"
```

### 5. Check App Logs
When you run the app, check Logcat for:
```bash
adb logcat | grep -i "PhoneNumberActivity\|ApiClient\|Driver"
```

Look for:
- `🔧 Initializing API client with base URL: ...`
- `🔍 Checking if driver exists for phone: ...`
- `📡 Driver check response - Success: true/false`
- `✅ Driver found: ...` or `❌ Driver not found`

## Current Configuration

- **API Base URL**: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev`
- **Backend Port**: `5001`
- **Database**: Local PostgreSQL (from .env)

## If Driver Not Found

1. **Check phone number format in database:**
   ```sql
   SELECT id, name, "phoneNumber" FROM "Drivers" LIMIT 10;
   ```

2. **Test with exact phone from database:**
   ```bash
   curl -H "ngrok-skip-browser-warning: true" \
     "https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/drivers/phone/YOUR_PHONE_HERE"
   ```

3. **Check backend logs:**
   ```bash
   # Check backend console for driver lookup logs
   # Should show: "🔍 Looking up driver with phone: ..."
   # Should show: "📋 Trying X variants: ..."
   ```

## Common Issues

1. **ngrok URL changed**: Update `app/build.gradle` line 52
2. **Backend not running**: Start with `cd backend && npm start`
3. **Database connection issue**: Check `.env` DATABASE_URL
4. **Phone format mismatch**: Backend tries multiple formats, but check database format


