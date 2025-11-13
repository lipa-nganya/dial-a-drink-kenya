# Building Local Dev APK

## Quick Build Command

Run this command in your terminal (it requires interactive input):

```bash
cd DDDriverExpo
eas build --platform android --profile local-dev
```

## First Time Setup

If this is your first time building, you'll be prompted to:

1. **Generate Android Keystore**: Type `y` to generate a new keystore (stored securely on Expo servers)
2. **Confirm build**: Review the build configuration and confirm

## What This Build Creates

- **APK File**: Android app package
- **App Name**: "DD Driver (Local)"
- **Bundle ID**: `com.dialadrink.driver.local`
- **API URL**: Connects to `localhost` or your `EXPO_PUBLIC_API_BASE_URL`

## After Build Completes

1. **Download APK**: You'll get a download link via email or in the terminal
2. **Install on Device**: Transfer APK to your Android device and install
3. **Test**: The app will connect to your local backend

## Alternative: Build Locally (Faster, No EAS)

If you want to build locally without EAS:

```bash
cd DDDriverExpo

# Install dependencies
npm install

# Build APK locally (requires Android Studio setup)
npx expo run:android --variant release
```

## Troubleshooting

### "Keystore generation failed"
- Make sure you're logged in: `eas login`
- Try again - sometimes Expo servers are busy

### "Build taking too long"
- EAS builds happen in the cloud and can take 10-20 minutes
- Check build status: `eas build:list`

### "Want faster builds?"
- Use local builds: `npx expo run:android`
- Requires Android Studio and Android SDK setup

## Build Status

Check your build status:
```bash
eas build:list
```

Download completed build:
```bash
eas build:download
```

