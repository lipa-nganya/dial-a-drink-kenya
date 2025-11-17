# Driver App Setup Instructions

## Problem: APK Not Found

The React Native project structure needs to be fully initialized. Here are two solutions:

## Solution 1: Initialize React Native Project (Recommended)

### Step 1: Create a fresh React Native project

```bash
cd /Users/maria/dial-a-drink
npx react-native@latest init DDDriver --version 0.73.0
```

This will create a new directory `DDDriver` with the full React Native structure.

### Step 2: Copy our source files

```bash
# Copy our source files to the new project
cp -r driver-app/src DDDriver/
cp driver-app/App.js DDDriver/
cp driver-app/index.js DDDriver/
cp driver-app/package.json DDDriver/
cp driver-app/babel.config.js DDDriver/
cp driver-app/metro.config.js DDDriver/
cp driver-app/app.json DDDriver/
```

### Step 3: Install dependencies

```bash
cd DDDriver
npm install
npm install @react-native-async-storage/async-storage axios @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context
```

### Step 4: Update package.json scripts

Make sure `package.json` has:
```json
{
  "scripts": {
    "android": "react-native run-android",
    "start": "react-native start",
    "build:apk": "cd android && ./gradlew assembleRelease",
    "build:apk-debug": "cd android && ./gradlew assembleDebug"
  }
}
```

### Step 5: Build the APK

```bash
cd android
./gradlew assembleDebug
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

## Solution 2: Manual Setup (Advanced)

If you prefer to fix the existing structure:

### Step 1: Install React Native CLI globally

```bash
npm install -g react-native-cli
```

### Step 2: Create missing Android files

You'll need to create:
- `android/build.gradle`
- `android/settings.gradle`
- `android/gradle.properties`
- `android/app/build.gradle`
- `android/gradle/wrapper/gradle-wrapper.properties`
- And many more files...

This is complex and error-prone. **I recommend Solution 1.**

## Solution 3: Use Expo (Easier Alternative)

Expo is simpler but requires different setup:

```bash
npx create-expo-app DDDriverExpo
cd DDDriverExpo
npm install @react-navigation/native @react-navigation/native-stack
# Copy our source files
# Build APK with: eas build --platform android
```

## Quick Fix: Copy from Working Template

If you have another React Native project, you can copy the `android` folder structure:

```bash
# From a working React Native project
cp -r /path/to/working-rn-project/android /Users/maria/dial-a-drink/driver-app/
# Then update package names and configuration
```

## Recommended Next Steps

1. **Use Solution 1** - Initialize fresh React Native project
2. Copy our source files
3. Install dependencies
4. Build APK
5. Install on device

## Alternative: Test in Browser First (Not Recommended)

React Native apps can't run in a browser, but you could:
- Use Expo Go app on your phone
- Or use React Native Web (requires significant changes)

## Current Status

✅ Source code files created
✅ App logic complete
✅ API integration configured
❌ React Native project structure incomplete
❌ Android build files missing

## Need Help?

The React Native initialization requires:
- Android Studio installed
- Android SDK configured
- Java JDK installed
- Environment variables set

If you encounter issues, you might want to:
1. Install Android Studio first
2. Set up Android SDK
3. Then initialize React Native project

Or use Expo which handles all this automatically!

















