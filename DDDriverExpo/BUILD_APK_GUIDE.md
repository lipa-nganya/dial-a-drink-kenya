# Build APK with Expo EAS

## Step-by-Step Guide

### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
cd /Users/maria/dial-a-drink/DDDriverExpo
eas login
```

**If you don't have an Expo account:**
1. Go to https://expo.dev
2. Click "Sign Up" (free)
3. Create account
4. Then run `eas login`

### Step 3: Configure EAS Build

The `eas.json` file has already been created with the correct configuration for building APKs.

### Step 4: Build the APK

```bash
eas build --platform android --profile preview
```

This will:
- Upload your project to Expo's servers
- Build the APK in the cloud
- Send you a link to download when complete

**Build time:** Usually 10-20 minutes

### Step 5: Download the APK

Once the build completes:
1. You'll receive an email with download link
2. Or check build status: `eas build:list`
3. Download: `eas build:download` (downloads latest build)

### Step 6: Install on Your Phone

1. Transfer APK to your phone
2. Enable "Install from Unknown Sources" in Android settings
3. Open APK and install

## Alternative: Build Locally (Faster)

If you have Android Studio installed:

```bash
# Install EAS CLI locally
npm install eas-cli --save-dev

# Build locally
npx eas build --platform android --profile preview --local
```

This builds on your machine instead of cloud (faster but requires Android Studio setup).

## Check Build Status

```bash
# List all builds
eas build:list

# Check specific build
eas build:view [BUILD_ID]
```

## Download Build

```bash
# Download latest build
eas build:download

# Download specific build
eas build:download [BUILD_ID]
```

## Troubleshooting

### "Not logged in"
```bash
eas login
```

### "Build failed"
- Check internet connection
- Verify `app.json` is valid
- Check build logs: `eas build:view [BUILD_ID]`

### "APK not found after download"
- Check `./builds/` directory
- Or use `eas build:download` to download again

## Quick Commands

```bash
# Login
eas login

# Build APK
eas build --platform android --profile preview

# Check status
eas build:list

# Download
eas build:download
```

## Current Configuration

- **Profile**: `preview` (builds APK for internal testing)
- **Build Type**: `apk` (not app bundle)
- **Package**: `com.dialadrink.driver`
- **App Name**: DD Driver

## Notes

- **Free tier**: Expo allows free cloud builds
- **Build limit**: Free accounts have limited builds per month
- **Speed**: Cloud builds take 10-20 minutes
- **Local builds**: Faster but require Android Studio

Ready to build! 🚀

