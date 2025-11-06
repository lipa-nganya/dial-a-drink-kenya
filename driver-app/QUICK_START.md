# Quick Start Guide - Driver App

## Prerequisites

Before you can access the driver app, you need:

1. **Node.js 18+** (already installed)
2. **React Native development environment**
3. **Android Studio** (for building/running Android app)
4. **Java JDK 11+**

## Step 1: Install Dependencies

```bash
cd driver-app
npm install
```

## Step 2: Choose Your Method

You have 3 options to access the app:

### Option A: Android Emulator (Recommended for Development)

1. **Install Android Studio** (if not installed):
   - Download from: https://developer.android.com/studio
   - Install Android SDK and create an emulator

2. **Start Android Emulator**:
   - Open Android Studio
   - Tools → Device Manager → Create/Start Virtual Device

3. **Update API URL** (if using emulator):
   - Edit `src/services/api.js`
   - Uncomment the Android Emulator option:
   ```javascript
   if (Platform.OS === 'android' && __DEV__) {
     return 'http://10.0.2.2:5001/api';
   }
   ```
   - Comment out the ngrok URL

4. **Run the app**:
   ```bash
   npm start
   # In another terminal:
   npm run android
   ```

### Option B: Physical Device - Install APK (Easiest)

1. **Make sure backend and ngrok are running**:
   ```bash
   # Terminal 1: Start backend
   cd backend
   npm start
   
   # Terminal 2: Start ngrok (if not already running)
   ngrok http 5001
   ```

2. **Build the APK**:
   ```bash
   cd driver-app
   npm install  # If not done already
   
   # For debug APK (easier, no signing required)
   cd android
   ./gradlew assembleDebug
   ```

3. **Find the APK**:
   - Location: `driver-app/android/app/build/outputs/apk/debug/app-debug.apk`

4. **Install on your phone**:
   - **Method 1 - ADB** (if USB debugging enabled):
     ```bash
     adb install android/app/build/outputs/apk/debug/app-debug.apk
     ```
   
   - **Method 2 - Manual**:
     - Transfer APK to phone (email, USB, cloud storage)
     - On phone: Settings → Security → Enable "Install from Unknown Sources"
     - Open APK file on phone and install

5. **The app is already configured** to use your ngrok URL!

### Option C: Physical Device - Development Mode

1. **Enable USB Debugging** on your phone:
   - Settings → About Phone → Tap "Build Number" 7 times
   - Settings → Developer Options → Enable USB Debugging

2. **Connect phone via USB**

3. **Verify connection**:
   ```bash
   adb devices
   ```
   Should show your device

4. **Run the app**:
   ```bash
   cd driver-app
   npm start
   npm run android
   ```

## Step 3: First Time Login

1. **Add driver in admin dashboard first**:
   - Go to http://localhost:3001 (admin frontend)
   - Login as admin
   - Go to "Drivers" page
   - Click "Add Driver"
   - Enter driver name and phone number (e.g., `254712345678`)
   - Save

2. **Open driver app** on your phone/emulator

3. **Enter phone number** (same one you added in admin dashboard)

4. **Receive OTP** via SMS (check your phone)

5. **Enter OTP** (6 digits)

6. **Set PIN** (4 digits)

7. **Confirm PIN**

8. **Access dashboard**!

## Step 4: Subsequent Logins

- Just enter your 4-digit PIN
- No need for OTP again

## Troubleshooting

### "Cannot connect to server"
- Check backend is running: `curl http://localhost:5001/api/health`
- Check ngrok is running (if using physical device)
- Verify API URL in `src/services/api.js`

### "Driver not found"
- Make sure driver was added in admin dashboard first
- Verify phone number matches exactly (format: 254712345678)

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

### "Metro bundler error"
```bash
cd driver-app
npm start -- --reset-cache
```

## Quick Reference

### Build Debug APK
```bash
cd driver-app/android
./gradlew assembleDebug
```

### Build Release APK
```bash
cd driver-app/android
./gradlew assembleRelease
```

### Run on Emulator
```bash
cd driver-app
npm run android
```

### Check if device connected
```bash
adb devices
```

### Install APK via ADB
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Check backend health
```bash
curl http://localhost:5001/api/health
```

### Check ngrok URL
```bash
curl https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api/health
```

## Current Configuration

- **Ngrok URL**: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev`
- **Backend Port**: `5001`
- **Admin Dashboard**: `http://localhost:3001`
- **API Base URL**: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api`

## Next Steps

Once you can access the app:
1. Test login flow (phone → OTP → PIN setup)
2. Test PIN login
3. Verify driver activity updates in admin dashboard
4. Future: Add order management features






