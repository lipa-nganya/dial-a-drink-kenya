# How to Access the Driver App

## The Easiest Way: Build and Install APK

Since your ngrok is already configured, here's the simplest way to access the app:

### Step 1: Install Dependencies

```bash
cd /Users/maria/dial-a-drink/driver-app
npm install
```

### Step 2: Build the APK

```bash
cd android
./gradlew assembleDebug
```

This will create: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 3: Install on Your Phone

**Option A - Via ADB (if USB debugging enabled):**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B - Manual Installation:**
1. Copy `android/app/build/outputs/apk/debug/app-debug.apk` to your phone
2. On your phone: Settings → Security → Enable "Install from Unknown Sources"
3. Open the APK file on your phone and tap "Install"

### Step 4: Add Driver in Admin Dashboard First

**IMPORTANT:** Before using the app, add the driver in the admin dashboard:

1. Open admin dashboard: http://localhost:3001
2. Login as admin
3. Go to "Drivers" page
4. Click "Add Driver"
5. Enter:
   - Name: (e.g., "John Doe")
   - Phone Number: (e.g., "254712345678" - must be in this format)
   - Status: "offline"
6. Click "Create"

### Step 5: Open the App and Login

1. Open "DD Driver" app on your phone
2. Enter the phone number you added (e.g., `0712345678` or `254712345678`)
3. Click "Send OTP"
4. Check your SMS for the OTP code
5. Enter the 6-digit OTP
6. Set a 4-digit PIN
7. Confirm the PIN
8. You're in! 🎉

### Step 6: Future Logins

- Just open the app
- Enter your 4-digit PIN
- No OTP needed!

## Alternative: Run in Android Emulator

If you have Android Studio installed:

### Step 1: Start Android Emulator

1. Open Android Studio
2. Tools → Device Manager
3. Create/Start a virtual device

### Step 2: Update API Configuration

Edit `src/services/api.js` and make sure it uses:
```javascript
if (Platform.OS === 'android' && __DEV__) {
  return 'http://10.0.2.2:5001/api';
}
```

### Step 3: Run the App

```bash
cd /Users/maria/dial-a-drink/driver-app
npm start
# In another terminal:
npm run android
```

## Prerequisites Check

Before building, make sure you have:

- ✅ Node.js installed
- ✅ Backend server running (`npm start` in backend directory)
- ✅ Ngrok running (if using physical device)
- ✅ Android Studio installed (for building APK)
- ✅ Java JDK installed

## Quick Commands Reference

```bash
# Check backend is running
curl http://localhost:5001/api/health

# Check ngrok is running
curl https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/health

# Build debug APK
cd driver-app/android && ./gradlew assembleDebug

# Install via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Check connected devices
adb devices
```

## Troubleshooting

### "Cannot connect to backend"
- ✅ Backend running? Check: `curl http://localhost:5001/api/health`
- ✅ Ngrok running? (if using physical device)
- ✅ API URL correct? Check `src/services/api.js`

### "Driver not found"
- ✅ Driver added in admin dashboard? Check http://localhost:3001/drivers
- ✅ Phone number matches exactly? (format: 254712345678)

### "Build failed"
```bash
cd driver-app/android
./gradlew clean
cd ..
npm install
cd android
./gradlew assembleDebug
```

### "APK won't install"
- Enable "Install from Unknown Sources" in Android settings
- Or use: `adb install app-debug.apk`

## Current Setup

- **App Location**: `/Users/maria/dial-a-drink/driver-app`
- **Ngrok URL**: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev`
- **Backend**: `http://localhost:5001`
- **Admin Dashboard**: `http://localhost:3001`

## Summary

**Simplest path:**
1. `cd driver-app && npm install`
2. `cd android && ./gradlew assembleDebug`
3. Install APK on phone
4. Add driver in admin dashboard
5. Open app and login!

That's it! 🚀






