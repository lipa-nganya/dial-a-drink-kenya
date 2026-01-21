# Quick Start Guide

## Step 1: Open in Android Studio

1. Open Android Studio
2. File > Open
3. Navigate to: `/Users/maria/dial-a-drink/driver-app-native`
4. Click OK
5. Wait for Gradle sync (first time: 5-10 minutes)

## Step 2: Configure SDK

If prompted:
1. Click "SDK Manager" or Tools > SDK Manager
2. Ensure Android SDK Platform 34 is installed
3. Ensure Android SDK Build-Tools is installed

## Step 3: Connect Your Samsung Device

1. Enable Developer Options:
   - Settings > About Phone
   - Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings > Developer Options > USB Debugging (ON)
3. Connect phone to Mac via USB
4. Allow USB debugging when prompted
5. In Android Studio, you should see your device in the device dropdown

## Step 4: Build and Run

### Option A: Using Android Studio
1. Click the green "Run" button (▶️)
2. Select your Samsung device
3. Click OK
4. App will build and install automatically

### Option B: Using Command Line
```bash
cd /Users/maria/dial-a-drink/driver-app-native
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

## Step 5: Test

1. Open the app on your device
2. Enter phone number (e.g., 0712345678)
3. Verify OTP
4. Setup PIN (if new user) or login with PIN
5. Test push notifications by assigning an order

## Building Different Versions

### Local APK (Ngrok - Default)
```bash
./gradlew assembleDebug
```
APK location: `app/build/outputs/apk/debug/app-debug.apk`

### Dev APK (GCloud Backend)
Edit `app/build.gradle` and change line 50:
```kotlin
def apiUrl = project.findProperty('API_BASE_URL') ?: 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app'
```

Or use gradle property:
```bash
./gradlew assembleDebug -PAPI_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
```

## Troubleshooting

**"SDK not found"**
- Open SDK Manager in Android Studio
- Install Android SDK Platform 34

**"Gradle sync failed"**
- Check internet connection
- File > Invalidate Caches > Invalidate and Restart

**"Device not found"**
- Check USB debugging is enabled
- Try: `adb devices` in terminal
- May need to install Samsung USB drivers (usually not needed on Mac)

**"Build failed"**
- Check Android Studio's Build output for specific errors
- Ensure all dependencies are downloaded (check Gradle sync)

## What's Working

✅ Full authentication flow
✅ Order management (view, accept, update status)
✅ Wallet and profile screens
✅ Push notifications (FCM)
✅ Dark theme support
✅ Bottom navigation

## What's Not Yet Implemented

⚠️ Location tracking service
⚠️ Socket.io real-time updates
⚠️ Sound file for order acceptance (vibration works)


