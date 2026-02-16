# Driver App Build Instructions (Development)

## Overview
The driver app (which includes admin mobile functionality) is a native Android app that needs to be built using Android Studio or Gradle.

## Build Steps

### Option 1: Using Android Studio (Recommended)

1. **Open Project in Android Studio**
   ```bash
   cd /Users/maria/dial-a-drink/driver-app-native
   ```
   - Open Android Studio
   - File > Open > Select `driver-app-native` folder
   - Wait for Gradle sync (first time: 5-10 minutes)

2. **Select Build Variant**
   - Open **Build Variants** panel (View → Tool Windows → Build Variants)
   - Select `developmentDebug` variant
   - This will build the app with:
     - Package ID: `com.dialadrink.driver.dev`
     - App Name: "Dial A Drink Driver (Dev)"
     - API URL: `https://deliveryos-development-backend-805803410802.us-central1.run.app`

3. **Build APK**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Or click the green "Run" button to build and install directly to a connected device

4. **APK Location**
   ```
   app/build/outputs/apk/development/debug/app-development-debug.apk
   ```

### Option 2: Using Command Line (Requires Gradle)

If you have Gradle installed and configured:

```bash
cd /Users/maria/dial-a-drink/driver-app-native
chmod +x gradlew
./gradlew assembleDevelopmentDebug
```

The APK will be at:
```
app/build/outputs/apk/development/debug/app-development-debug.apk
```

## Configuration

The development build is configured in `gradle.properties`:
- `DEV_API_BASE_URL=https://deliveryos-development-backend-805803410802.us-central1.run.app`

This points to the GCloud dev backend that was just deployed.

## Installation

To install the APK on a device:
```bash
adb install app/build/outputs/apk/development/debug/app-development-debug.apk
```

Or use Android Studio's Run button to install directly to a connected device.

## Notes

- The driver app includes both driver and admin mobile functionality
- The development build can be installed alongside other variants (local, production)
- The app will connect to the GCloud dev backend that was just deployed
