# Driver App Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd driver-app
npm install
```

### 2. Configure Backend URL

Edit `src/services/api.js`:

**For Android Emulator (default):**
```javascript
return 'http://10.0.2.2:5001/api';
```

**For Physical Device via Ngrok:**
```javascript
return 'https://your-ngrok-url.ngrok-free.dev/api';
```

**For Physical Device via Local Network:**
```javascript
return 'http://192.168.1.XXX:5001/api'; // Your computer's local IP
```

### 3. Build APK

#### Debug APK (for testing):
```bash
npm run build:apk-debug
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK (for production):
```bash
npm run build:apk
```

APK location: `android/app/build/outputs/apk/release/app-release.apk`

## How APK Communicates with Local Server

### Option 1: Android Emulator
- **Use:** `http://10.0.2.2:5001/api`
- **Why:** `10.0.2.2` is a special IP that maps to `localhost` on the host machine
- **Already configured** in the app

### Option 2: Physical Device - Ngrok (Recommended)
1. Start ngrok: `ngrok http 5001`
2. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.dev`)
3. Update `src/services/api.js`:
   ```javascript
   return 'https://abc123.ngrok-free.dev/api';
   ```
4. Rebuild APK

### Option 3: Physical Device - Local Network IP
1. Find your computer's IP:
   ```bash
   # Mac/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
2. Update `src/services/api.js` with your IP (e.g., `192.168.1.100`)
3. Ensure phone and computer are on same WiFi
4. Rebuild APK

### Option 4: Physical Device - ADB Port Forwarding
1. Connect phone via USB
2. Enable USB debugging
3. Run: `adb reverse tcp:5001 tcp:5001`
4. Use `localhost:5001` in app (only works while USB connected)

## Testing the App

1. **First Time Setup:**
   - Enter phone number
   - Receive OTP
   - Enter OTP
   - Set PIN (4 digits)
   - Confirm PIN
   - Access dashboard

2. **Subsequent Logins:**
   - Enter PIN
   - Access dashboard

## Important Notes

- **Driver must exist in admin dashboard first** before they can log in
- Phone numbers are stored as digits only (no dashes or spaces)
- PIN is stored locally on device (not on server)
- OTP is sent via SMS using your configured SMS service

## Troubleshooting

### "Network Error"
- Check backend is running: `curl http://localhost:5001/api/health`
- Verify API URL in `src/services/api.js`
- For physical device, test URL in browser first

### "Driver not found"
- Add driver in admin dashboard first
- Verify phone number matches exactly (format: 254712345678)

### APK won't install
- Enable "Install from Unknown Sources" in Android settings
- Or use `adb install app-debug.apk`

### Build fails
- Run: `cd android && ./gradlew clean`
- Then: `npm run build:apk-debug`

















