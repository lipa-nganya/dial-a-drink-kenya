# Build Instructions

## Prerequisites
- Android Studio installed
- Android SDK (API 24+)
- Java JDK 8 or higher
- Physical Android device (Samsung) connected via USB

## Step 1: Open Project in Android Studio
1. Open Android Studio
2. File > Open
3. Navigate to `/Users/maria/dial-a-drink/driver-app-native`
4. Click OK
5. Wait for Gradle sync (first time takes a few minutes)

## Step 2: Select Build Variant

You now have **three separate apps** that can be installed side-by-side:

### Local Build (Ngrok):
- **Package ID**: `com.dialadrink.driver.local`
- **App Name**: "Dial A Drink Driver (Local)"
- **API**: Uses ngrok URL (configured in `gradle.properties` as `LOCAL_API_BASE_URL`)
- **Use Case**: Testing with local backend via ngrok

### Development Build (GCP):
- **Package ID**: `com.dialadrink.driver.dev`
- **App Name**: "Dial A Drink Driver (Dev)"
- **API**: Uses GCP backend (configured in `gradle.properties` as `DEV_API_BASE_URL`)
- **Use Case**: Testing with GCP development backend

### Production Build (GCP):
- **Package ID**: `com.dialadrink.driver`
- **App Name**: "Dial A Drink Driver"
- **API**: Uses GCP backend (configured in `gradle.properties` as `PROD_API_BASE_URL`)
- **Use Case**: Production release

### Configure API URLs (Optional):
Edit `gradle.properties` to customize URLs:
- `LOCAL_API_BASE_URL` - for local builds (default: ngrok)
- `DEV_API_BASE_URL` - for dev builds (default: GCP)
- `PROD_API_BASE_URL` - for production builds (default: GCP)

## Step 3: Connect Device
1. Enable Developer Options on Samsung:
   - Settings > About Phone > Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings > Developer Options > USB Debugging (ON)
3. Connect phone to Mac via USB
4. Allow USB debugging when prompted

## Step 4: Build and Install

### Option A: Using Android Studio
1. Select build variant:
   - Click on "Build Variants" tab (usually at bottom left)
   - Select `localDebug` for local build (ngrok)
   - Or `developmentDebug` for dev build (GCP)
   - Or `productionDebug` for production build
2. Click the green "Run" button (play icon)
3. Select your Samsung device
4. Click OK - it will build and install
5. **You can install all three variants side-by-side!**

### Option B: Using Command Line

#### Local Build (Ngrok):
```bash
cd /Users/maria/dial-a-drink/driver-app-native
./gradlew assembleLocalDebug
# APK: app/build/outputs/apk/local/debug/app-local-debug.apk
adb install app/build/outputs/apk/local/debug/app-local-debug.apk
```

#### Development Build (GCP):
```bash
./gradlew assembleDevelopmentDebug
# APK: app/build/outputs/apk/development/debug/app-development-debug.apk
adb install app/build/outputs/apk/development/debug/app-development-debug.apk
```

#### Production Build:
```bash
./gradlew assembleProductionDebug
# APK: app/build/outputs/apk/production/debug/app-production-debug.apk
adb install app/build/outputs/apk/production/debug/app-production-debug.apk
```

#### Production Release Build:
```bash
./gradlew assembleProductionRelease
# APK: app/build/outputs/apk/production/release/app-production-release.apk
```

## Step 5: Test
1. Open the app on your device
2. Note: Each build has a distinct name:
   - Local: "Dial A Drink Driver (Local)"
   - Dev: "Dial A Drink Driver (Dev)"
   - Production: "Dial A Drink Driver"
3. Enter phone number
4. Verify OTP
5. Setup PIN or login
6. Test push notifications
7. **You can have all three apps installed at the same time!**

## Build Variants Explained

### Local Build (`localDebug`):
- **Application ID**: `com.dialadrink.driver.local`
- **App Name**: "Dial A Drink Driver (Local)"
- **API URL**: Uses `LOCAL_API_BASE_URL` (default: ngrok)
- **Features**: 
  - Can be installed alongside other builds
  - Debuggable
  - Shows "(Local)" suffix in app name
  - Version name includes "-local" suffix
  - Perfect for testing with local backend

### Development Build (`developmentDebug`):
- **Application ID**: `com.dialadrink.driver.dev`
- **App Name**: "Dial A Drink Driver (Dev)"
- **API URL**: Uses `DEV_API_BASE_URL` (default: GCP)
- **Features**: 
  - Can be installed alongside other builds
  - Debuggable
  - Shows "(Dev)" suffix in app name
  - Version name includes "-dev" suffix
  - Perfect for testing with GCP backend

### Production Build (`productionDebug` or `productionRelease`):
- **Application ID**: `com.dialadrink.driver`
- **App Name**: "Dial A Drink Driver"
- **API URL**: Uses `PROD_API_BASE_URL` (default: GCP)
- **Features**:
  - Standard production app
  - Can be installed alongside other builds

## Benefits of Multiple Build Variants

1. **Side-by-Side Installation**: All three builds can be installed simultaneously
2. **No Configuration Switching**: Each app has its own fixed API endpoint
3. **Visual Distinction**: Each build shows its environment in the app name
4. **Separate Configuration**: Each build has its own API URL and settings
5. **Easy Testing**: Test local and dev backends without uninstalling apps
6. **Debugging**: Local and dev builds are debuggable by default

## Customizing API URLs

### Via gradle.properties:
```properties
LOCAL_API_BASE_URL=https://your-ngrok-url.ngrok-free.dev
DEV_API_BASE_URL=https://your-dev-backend.com
PROD_API_BASE_URL=https://your-prod-backend.com
```

### Via Command Line:
```bash
./gradlew assembleLocalDebug -PLOCAL_API_BASE_URL=https://custom-ngrok-url.com
./gradlew assembleDevelopmentDebug -PDEV_API_BASE_URL=https://custom-url.com
./gradlew assembleProductionDebug -PPROD_API_BASE_URL=https://custom-url.com
```


