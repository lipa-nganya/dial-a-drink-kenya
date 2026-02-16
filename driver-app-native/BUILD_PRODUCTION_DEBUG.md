# Build Driver App - Production Debug Variant

## Overview

This guide explains how to build the production debug variant of the driver app, which connects to the production backend API.

## Build Configuration

- **Variant**: `productionDebug`
- **Package ID**: `com.dialadrink.driver`
- **App Name**: "Dial A Drink Driver"
- **API URL**: `https://deliveryos-production-backend-805803410802.us-central1.run.app/api`
- **Build Type**: Debug (debbugable)

## Build Instructions

### Option 1: Using Android Studio (Recommended)

1. **Open Project**
   - Open Android Studio
   - File > Open > Select `driver-app-native` folder
   - Wait for Gradle sync

2. **Select Build Variant**
   - Open **Build Variants** panel (View → Tool Windows → Build Variants)
   - Select `productionDebug` variant

3. **Build APK**
   - Build → Build Bundle(s) / APK(s) → Build APK(s)
   - Or click the green "Run" button to build and install directly

4. **APK Location**
   ```
   app/build/outputs/apk/production/debug/app-production-debug.apk
   ```

### Option 2: Using Command Line

If you have Gradle installed:

```bash
cd driver-app-native
chmod +x gradlew
./gradlew assembleProductionDebug
```

The APK will be at:
```
app/build/outputs/apk/production/debug/app-production-debug.apk
```

## Configuration

The production API URL is configured in `gradle.properties`:

```properties
PROD_API_BASE_URL=https://deliveryos-production-backend-805803410802.us-central1.run.app
```

**Note**: The `/api` suffix is automatically added by `ApiClient.kt`, so don't include it in the URL.

## Installation

To install the APK on a device:

```bash
adb install app/build/outputs/apk/production/debug/app-production-debug.apk
```

Or use Android Studio's Run button to install directly to a connected device.

## Verification

After building and installing:

1. Open the app on your device
2. The app should connect to: `https://deliveryos-production-backend-805803410802.us-central1.run.app/api`
3. Test login and functionality

## Notes

- The production debug build can be installed alongside other variants (local, development)
- This build is debuggable, making it useful for production testing
- For final release, use `productionRelease` variant instead
