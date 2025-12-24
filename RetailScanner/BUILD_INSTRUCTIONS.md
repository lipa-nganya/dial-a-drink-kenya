# Retail Scanner Cloud-Dev Build Instructions

## Configuration Status
✅ Cloud-dev profile is configured correctly:
- Backend URL: https://dialadrink-backend-910510650031.us-central1.run.app
- Admin URL: https://dialadrink-admin-910510650031.us-central1.run.app
- Build Profile: cloud-dev
- Version: 1.0.1

## Before Building

### 1. Replace App Icon
Replace the icon files with the purple icon image:
- `assets/icon.png` (1024x1024px PNG)
- `assets/adaptive-icon.png` (1024x1024px PNG)
- `assets/splash-icon.png` (1024x1024px PNG)

### 2. Build Command
Run the build interactively (keystore generation requires user input):

```bash
cd RetailScanner
eas build --profile cloud-dev --platform android
```

When prompted:
- Select "Generate a new Android Keystore" (or use existing if available)
- Follow the prompts to complete the build

### 3. Build Output
After successful build, you'll receive:
- APK download link
- QR code for installation
- Build ID for tracking

## Environment Variables
The cloud-dev profile automatically sets:
- EXPO_PUBLIC_ENV: cloud
- EXPO_PUBLIC_BUILD_PROFILE: cloud-dev
- EXPO_PUBLIC_API_BASE_URL: https://dialadrink-backend-910510650031.us-central1.run.app

## App Configuration
- App Name: Retail Scanner (Dev)
- Bundle ID: com.dialadrink.retailscanner
- Package Name: com.dialadrink.retailscanner
