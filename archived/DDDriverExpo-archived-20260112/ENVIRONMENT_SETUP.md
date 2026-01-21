# Driver App - Environment Setup Guide

## 🎯 Separate Local and Cloud Apps (No Additional Costs!)

You can have separate apps for local development and cloud/dev deployment **without incurring additional costs** by using:

1. **Same Expo Project** (one EAS project = free)
2. **Different Bundle Identifiers** (allows installing both apps on same device)
3. **Environment Variables** (switches API URLs automatically)

## 📱 How It Works

- **Local Dev App**: `com.dialadrink.driver.local` → Connects to `localhost` or ngrok
- **Cloud Dev App**: `com.dialadrink.driver` → Connects to cloud backend
- **Same Expo Project**: No additional EAS costs!

## 🚀 Quick Start

### Option 1: Development with Expo Go (Easiest)

```bash
# Set environment variable
export EXPO_PUBLIC_ENV=local
export EXPO_PUBLIC_API_BASE_URL=http://localhost:5001

# Start Expo
npx expo start
```

**Note**: Expo Go uses the API URL from `app.config.js` which reads from environment variables.

### Option 2: Build Separate APKs

#### Build Local Dev APK

```bash
# Set environment (optional, already in eas.json)
export EXPO_PUBLIC_ENV=local

# Build APK for local development
eas build --platform android --profile local-dev
```

This creates an APK that:
- App name: "DD Driver (Local)"
- Bundle ID: `com.dialadrink.driver.local`
- Connects to: `localhost` or your `EXPO_PUBLIC_API_BASE_URL`

#### Build Cloud Dev APK

```bash
# Set environment (optional, already in eas.json)
export EXPO_PUBLIC_ENV=cloud

# Build APK for cloud/dev
eas build --platform android --profile cloud-dev
```

This creates an APK that:
- App name: "DD Driver (Dev)"
- Bundle ID: `com.dialadrink.driver`
- Connects to: Cloud backend URL

## 📋 Environment Variables

Create a `.env` file in `DDDriverExpo/`:

```bash
# For local development
EXPO_PUBLIC_ENV=local
EXPO_PUBLIC_API_BASE_URL=http://localhost:5001

# OR for cloud/dev
EXPO_PUBLIC_ENV=cloud
EXPO_PUBLIC_API_BASE_URL=https://dialadrink-backend-910510650031.us-central1.run.app
```

## 🔧 Configuration Details

### Build Profiles (in `eas.json`)

- **`local-dev`**: Local development build
  - Bundle ID: `com.dialadrink.driver.local`
  - API: Uses `EXPO_PUBLIC_API_BASE_URL` or defaults to `localhost`
  
- **`cloud-dev`**: Cloud/dev build
  - Bundle ID: `com.dialadrink.driver`
  - API: Uses cloud backend URL

- **`production`**: Production build
  - Bundle ID: `com.dialadrink.driver`
  - API: Uses cloud backend URL

### App Configuration (in `app.config.js`)

The `app.config.js` file automatically:
- Detects environment from `EAS_BUILD_PROFILE` or `EXPO_PUBLIC_ENV`
- Sets appropriate bundle identifier
- Configures API base URL
- Adds environment suffix to app name

## 💰 Cost Breakdown

✅ **FREE**:
- Same Expo project (one EAS project ID)
- Multiple build profiles
- Different bundle identifiers
- Environment-based configuration

❌ **Would Cost Extra** (NOT needed):
- Separate Expo projects
- Separate EAS accounts

## 📱 Installing Both Apps

Since they have different bundle IDs, you can install both apps on the same device:

1. Install local-dev APK → "DD Driver (Local)"
2. Install cloud-dev APK → "DD Driver (Dev)"

Both will work simultaneously!

## 🔄 Switching Environments

### During Development (Expo Go)

```bash
# Local
export EXPO_PUBLIC_ENV=local
export EXPO_PUBLIC_API_BASE_URL=http://localhost:5001
npx expo start

# Cloud
export EXPO_PUBLIC_ENV=cloud
npx expo start
```

### For APK Builds

```bash
# Local APK
eas build --platform android --profile local-dev

# Cloud APK
eas build --platform android --profile cloud-dev

# Production APK
eas build --platform android --profile production
```

## 🐛 Troubleshooting

### "App not connecting to backend"

1. Check environment variable:
   ```bash
   echo $EXPO_PUBLIC_API_BASE_URL
   ```

2. For local development, ensure:
   - Backend is running on port 5001
   - If using physical device: ngrok is running or use your computer's IP
   - If using emulator: `http://10.0.2.2:5001` works automatically

### "Both apps have same name"

- Check bundle IDs are different:
  - Local: `com.dialadrink.driver.local`
  - Cloud: `com.dialadrink.driver`
- App names should show "(Local)" and "(Dev)" suffixes

### "Build failed"

- Ensure you're logged into EAS: `eas login`
- Check `eas.json` has correct profile names
- Verify environment variables are set correctly

## 📚 Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS Build Profiles](https://docs.expo.dev/build/eas-json/)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)

