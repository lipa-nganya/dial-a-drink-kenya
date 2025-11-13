# Fix: "Failed to send OTP" on Local Build

## Problem

The local build was created with `localhost:5001` as the API URL, which doesn't work on physical devices. Physical devices can't reach `localhost` on your development machine.

## Solution: Rebuild with Ngrok URL

### Quick Fix

1. **Make sure ngrok is running:**
   ```bash
   ngrok http 5001
   ```

2. **Rebuild the APK with ngrok URL:**
   ```bash
   cd DDDriverExpo
   ./rebuild-local-with-ngrok.sh
   ```

   Or manually:
   ```bash
   export EXPO_PUBLIC_API_BASE_URL=https://your-ngrok-url.ngrok-free.dev
   eas build --platform android --profile local-dev
   ```

3. **Download and install the new APK:**
   ```bash
   eas build:download
   ```

### Alternative: Use Your Computer's IP Address

If you don't want to use ngrok:

1. **Find your computer's IP address:**
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Or
   ipconfig getifaddr en0  # macOS
   ```

2. **Rebuild with IP address:**
   ```bash
   export EXPO_PUBLIC_API_BASE_URL=http://YOUR_IP_ADDRESS:5001
   eas build --platform android --profile local-dev
   ```

   **Note:** Your phone and computer must be on the same WiFi network.

### Verify Current Configuration

To see what URL the app is trying to use, check the app logs:

1. Connect your device via USB
2. Enable USB debugging
3. Check logs:
   ```bash
   adb logcat | grep "Using API URL"
   ```

## Why This Happened

The `app.config.js` was defaulting to `localhost:5001` for local builds. This works fine in:
- ✅ Android Emulator (uses `10.0.2.2` mapping)
- ✅ iOS Simulator (shares localhost)
- ❌ Physical devices (can't reach your computer's localhost)

## Updated Configuration

The `app.config.js` has been updated to:
- Use ngrok URL by default for local builds
- Show clear warnings if using localhost
- Log the API URL being used

After rebuilding, the app will automatically use the ngrok URL.

## Quick Test

After rebuilding and installing:

1. Open the app
2. Try to send OTP
3. Check the logs - you should see: `🌐 Using API URL from app config: https://your-ngrok-url.ngrok-free.dev/api`

If you still see errors, check:
- Backend is running: `curl http://localhost:5001/api/health`
- Ngrok is running: `curl http://localhost:4040/api/tunnels`
- Phone has internet connection

