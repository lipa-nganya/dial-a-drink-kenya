# Local Android Build Guide

## Prerequisites Check

1. **Android Studio** - Download from: https://developer.android.com/studio
2. **Java JDK** - Android Studio includes it, or install separately
3. **Android SDK** - Installed via Android Studio

## Step-by-Step Build Process

### Step 1: Install Android Studio (if not installed)
1. Download from: https://developer.android.com/studio
2. Install Android Studio
3. Open Android Studio
4. Go through the setup wizard (it will install Android SDK automatically)
5. Install Android SDK Platform 33 or 34 (via SDK Manager)

### Step 2: Generate Native Android Project
```bash
cd /Users/maria/dial-a-drink/DDDriverExpo
npx expo prebuild --platform android --clean
```

This creates the `android` folder with native code.

### Step 3: Open in Android Studio
1. Open Android Studio
2. Click "Open an Existing Project"
3. Navigate to: `/Users/maria/dial-a-drink/DDDriverExpo/android`
4. Wait for Gradle sync to complete (first time takes a few minutes)

### Step 4: Connect Your Samsung Device
1. Enable Developer Options on your Samsung:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings > Developer Options > USB Debugging (ON)
3. Connect phone via USB to Mac
4. On phone, when prompted, allow USB debugging

### Step 5: Build and Install
**Option A: Using Android Studio**
1. In Android Studio, click the green "Run" button (play icon)
2. Select your Samsung device from the device dropdown
3. Click OK - it will build and install automatically

**Option B: Using Command Line**
```bash
cd /Users/maria/dial-a-drink/DDDriverExpo/android
./gradlew assembleDebug
# APK will be at: android/app/build/outputs/apk/debug/app-debug.apk
# Then install manually via: adb install app-debug.apk
```

### Step 6: Verify Build
- App should install on your Samsung
- Open the app and log in
- Push token should generate successfully (no more Firebase conflict!)

## Troubleshooting

**If prebuild fails:**
- Make sure you're in the DDDriverExpo directory
- Try: `npx expo install --fix`

**If Android Studio can't find device:**
- Check USB debugging is enabled
- Try: `adb devices` in terminal (should show your device)
- May need to install Samsung USB drivers (usually not needed on Mac)

**If build fails:**
- Check Android Studio's Build output for errors
- Make sure Android SDK is installed (Tools > SDK Manager)

## What's Fixed in This Build
✅ `googleServicesFile` removed - no Firebase conflict
✅ Uses Expo-managed FCM - `getExpoPushTokenAsync()` for all builds
✅ Push notifications will work correctly


