# Development Build Configuration Guide

## Overview

The Android app now supports separate **development** and **production** build variants. This allows you to:
- Install both versions side-by-side on the same device
- Easily switch between development and production API endpoints
- Visually distinguish development builds (shows "(Dev)" in app name)

## Quick Start

### Building Local APK (Ngrok)
```bash
cd driver-app-native
./gradlew assembleLocalDebug
```

The APK will be at: `app/build/outputs/apk/local/debug/app-local-debug.apk`

### Building Development APK (GCP)
```bash
./gradlew assembleDevelopmentDebug
```

The APK will be at: `app/build/outputs/apk/development/debug/app-development-debug.apk`

### Building Production APK
```bash
./gradlew assembleProductionDebug
```

The APK will be at: `app/build/outputs/apk/production/debug/app-production-debug.apk`

## Build Variants

### Local Build
- **Variant**: `localDebug`
- **Package ID**: `com.dialadrink.driver.local`
- **App Name**: "Dial A Drink Driver (Local)"
- **Version**: Includes "-local" suffix
- **API URL**: Configured via `LOCAL_API_BASE_URL` (default: ngrok)
- **Debugging**: Enabled
- **Use Case**: Testing with local backend via ngrok

### Development Build
- **Variant**: `developmentDebug`
- **Package ID**: `com.dialadrink.driver.dev`
- **App Name**: "Dial A Drink Driver (Dev)"
- **Version**: Includes "-dev" suffix
- **API URL**: Configured via `DEV_API_BASE_URL` (default: GCP backend)
- **Debugging**: Enabled
- **Use Case**: Testing with GCP development backend

### Production Build
- **Variant**: `productionDebug` or `productionRelease`
- **Package ID**: `com.dialadrink.driver`
- **App Name**: "Dial A Drink Driver"
- **API URL**: Configured via `PROD_API_BASE_URL` (default: GCP)
- **Debugging**: Enabled for debug, disabled for release
- **Use Case**: Production release

## Configuration

### API URLs

Edit `gradle.properties` to set custom API URLs:

```properties
# Local API (default: ngrok)
LOCAL_API_BASE_URL=https://homiest-psychopharmacologic-anaya.ngrok-free.dev

# Development API (default: GCP backend)
DEV_API_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app

# Production API (default: GCP)
PROD_API_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
```

### Override via Command Line

```bash
# Development build with custom API
./gradlew assembleDevelopmentDebug -PDEV_API_BASE_URL=https://custom-dev-api.com

# Production build with custom API
./gradlew assembleProductionDebug -PPROD_API_BASE_URL=https://custom-prod-api.com
```

## Using Android Studio

1. Open the project in Android Studio
2. Open the **Build Variants** panel (View → Tool Windows → Build Variants)
3. Select the variant you want:
   - `developmentDebug` - for development testing
   - `productionDebug` - for production testing
   - `productionRelease` - for production release
4. Click Run (▶️) to build and install

## Benefits

1. **Side-by-Side Installation**: Both builds can be installed simultaneously
2. **Easy Testing**: Switch between dev and prod without uninstalling
3. **Visual Distinction**: Dev build clearly shows "(Dev)" in app name
4. **Separate Configurations**: Each build has its own API endpoint
5. **No Code Changes**: Switch builds without modifying source code

## Troubleshooting

### Build Fails with "Cannot find signing config"
- The debug keystore will be auto-generated on first build
- Or create manually: `keytool -genkey -v -keystore app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000`

### Wrong API URL
- Check `gradle.properties` for `DEV_API_BASE_URL` or `PROD_API_BASE_URL`
- Verify the build variant you're using matches the API you want
- Use command line override if needed

### App Name Not Showing "(Dev)"
- Ensure you're building the `developmentDebug` variant
- Check Build Variants panel in Android Studio
- Clean and rebuild: `./gradlew clean assembleDevelopmentDebug`

## File Locations

- **Build Config**: `app/build.gradle`
- **Properties**: `gradle.properties`
- **Local APK**: `app/build/outputs/apk/local/debug/`
- **Development APK**: `app/build/outputs/apk/development/debug/`
- **Production APK**: `app/build/outputs/apk/production/debug/` or `release/`
