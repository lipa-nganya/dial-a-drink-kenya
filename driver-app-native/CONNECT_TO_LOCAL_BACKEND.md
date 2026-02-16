# Connecting Admin Mobile App to Local Backend

## Problem
The admin mobile app is not connected to the local backend. Orders placed don't appear, and completed orders shown are from a remote database.

## Solution

### Step 1: Check Your Setup

**Are you using:**
- **Android Emulator** → Use `http://10.0.2.2:5001`
- **Physical Device** → Use ngrok or your local IP

### Step 2: Update Configuration

1. **Edit `gradle.properties`**:
   ```properties
   # For Android Emulator:
   LOCAL_API_BASE_URL=http://10.0.2.2:5001
   
   # OR for Physical Device with ngrok:
   LOCAL_API_BASE_URL=https://your-ngrok-url.ngrok-free.dev
   
   # OR for Physical Device with local IP:
   LOCAL_API_BASE_URL=http://192.168.1.100:5001
   ```

2. **Find your local IP** (if using physical device):
   ```bash
   # macOS/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows:
   ipconfig
   ```

3. **Set up ngrok** (if using physical device):
   ```bash
   # Install ngrok if not already installed
   # Then run:
   ngrok http 5001
   # Copy the HTTPS URL (e.g., https://abc123.ngrok-free.dev)
   # Update LOCAL_API_BASE_URL in gradle.properties
   ```

### Step 3: Build with Local Variant

**In Android Studio:**
1. Go to **Build** → **Select Build Variant**
2. Select **localDebug** (not developmentDebug or productionDebug)
3. Rebuild the app: **Build** → **Rebuild Project**

**Or via command line:**
```bash
cd driver-app-native
./gradlew assembleLocalDebug
```

### Step 4: Verify Connection

1. **Check backend is running:**
   ```bash
   curl http://localhost:5001/api/health
   # Should return: {"status":"OK","message":"Dial A Drink API is running"}
   ```

2. **Check app logs:**
   - In Android Studio, open **Logcat**
   - Filter by: `ApiClient`
   - Look for: `🔧 BuildConfig.API_BASE_URL: http://10.0.2.2:5001` (or your configured URL)

3. **Test in app:**
   - Place an order
   - Check if it appears in the orders list
   - Verify it's saved to your local database

### Step 5: Verify Database Connection

Check your local database to confirm orders are being saved:
```bash
# Connect to your local PostgreSQL database
# Check the orders table
SELECT * FROM "Orders" ORDER BY "createdAt" DESC LIMIT 10;
```

## Troubleshooting

### Orders still not appearing?

1. **Check build variant:**
   - App name should show: "Dial A Drink Driver (Local)"
   - If it shows "(Dev)" or no suffix, you're using the wrong variant

2. **Check API URL in logs:**
   - Look for `🔧 BuildConfig.API_BASE_URL` in Logcat
   - Should match your `LOCAL_API_BASE_URL` setting

3. **Check backend logs:**
   - Look for incoming requests in your backend console
   - Should see POST requests to `/api/orders`

4. **Check network:**
   - Emulator: Make sure backend is running on `localhost:5001`
   - Physical device: Make sure device and computer are on same network
   - ngrok: Make sure ngrok is running and URL is correct

### Still having issues?

1. **Clear app data:**
   - Settings → Apps → Dial A Drink Driver (Local) → Clear Data
   - Reinstall the app

2. **Rebuild from scratch:**
   ```bash
   cd driver-app-native
   ./gradlew clean
   ./gradlew assembleLocalDebug
   ```

3. **Check backend CORS:**
   - Make sure your backend allows requests from the app
   - Check `backend/app.js` for CORS configuration
