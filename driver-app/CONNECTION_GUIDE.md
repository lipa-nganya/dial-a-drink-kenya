# Driver App Connection Guide

## Problem: "This site can't be reached" or "Network Error"

This happens when the app can't connect to your backend server. Here are solutions based on your setup:

## Solution 1: Android Emulator

**If you're using Android Emulator:**

1. Make sure backend is running: `curl http://localhost:5001/api/health`
2. The app is already configured to use `http://10.0.2.2:5001/api`
3. **Important:** `10.0.2.2` ONLY works in Android Emulator, not in browser or physical device

**To test:**
- Run the app in Android Emulator
- The URL `10.0.2.2` will automatically map to `localhost` on your host machine

## Solution 2: Physical Device via Ngrok (Recommended)

**If you're using a physical Android device:**

1. Start ngrok:
   ```bash
   ngrok http 5001
   ```

2. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)

3. Update `src/services/api.js`:
   ```javascript
   const getBaseURL = () => {
     // For Physical Device - Ngrok
     return 'https://abc123.ngrok-free.dev/api';
   };
   ```

4. Rebuild the app:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

5. Install the new APK on your device

## Solution 3: Physical Device via Local Network

**If you want to use your local WiFi network:**

1. Find your computer's local IP address:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
   Look for something like `192.168.1.100` or `192.168.0.105`

2. Update `src/services/api.js`:
   ```javascript
   const getBaseURL = () => {
     // For Physical Device - Local Network
     return 'http://192.168.1.100:5001/api'; // Replace with your IP
   };
   ```

3. **Important:** Make sure:
   - Your phone and computer are on the same WiFi network
   - Your firewall allows connections on port 5001
   - Test the URL in your phone's browser first: `http://192.168.1.100:5001/api/health`

4. Rebuild the app and install

## Solution 4: Physical Device via USB + ADB

**If you have USB debugging enabled:**

1. Connect phone via USB
2. Enable USB debugging in Android settings
3. Run ADB port forwarding:
   ```bash
   adb reverse tcp:5001 tcp:5001
   ```

4. Update `src/services/api.js`:
   ```javascript
   const getBaseURL = () => {
     return 'http://localhost:5001/api';
   };
   ```

5. Rebuild and install app
6. **Note:** This only works while USB is connected

## Testing the Connection

### Test 1: Backend is running
```bash
curl http://localhost:5001/api/health
```
Should return: `{"status":"OK","message":"Dial A Drink API is running"}`

### Test 2: Test from Android Emulator
```bash
adb shell
curl http://10.0.2.2:5001/api/health
```

### Test 3: Test from Physical Device (Ngrok)
Open browser on phone and visit: `https://your-ngrok-url.ngrok-free.dev/api/health`

### Test 4: Test from Physical Device (Local Network)
Open browser on phone and visit: `http://192.168.1.XXX:5001/api/health`

## Quick Fix Checklist

- [ ] Backend server is running on port 5001
- [ ] You've updated `src/services/api.js` with correct URL
- [ ] You've rebuilt the APK after changing the URL
- [ ] You've installed the new APK on device
- [ ] For physical device: Phone and computer are on same WiFi (or using ngrok)
- [ ] For physical device: Tested URL in phone browser first

## Common Issues

### "Network Error" in App
- Check backend is running: `curl http://localhost:5001/api/health`
- Verify URL in `src/services/api.js` is correct
- For physical device, test URL in browser first

### "Connection Refused"
- Backend not running - start it: `cd backend && npm start`
- Wrong port - check backend is on port 5001
- Firewall blocking - check firewall settings

### "This site can't be reached" (Browser)
- `10.0.2.2` only works in Android Emulator, not browser
- Use ngrok URL or local network IP for browser testing

### App Works in Emulator but Not on Phone
- Change URL in `src/services/api.js` from `10.0.2.2` to ngrok or local IP
- Rebuild APK
- Install new APK on device





