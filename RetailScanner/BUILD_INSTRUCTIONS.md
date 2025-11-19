# Retail Scanner - Build Instructions

## Project Setup Complete ✅

The RetailScanner project has been configured:
- **Project ID**: `2012aa46-473a-4dd1-8061-0135a89e8cf6`
- **Project Slug**: `retail-scanner`
- **Owner**: `dialadrink`
- **Local API URL**: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev` (ngrok)

## To Create a Local Build

Run this command interactively (it will prompt for keystore generation):

```bash
cd RetailScanner
npx eas-cli build --profile local-dev --platform android
```

When prompted:
1. **Generate a new Android Keystore?** → Answer `y` (yes)
2. The build will start and you'll get a URL to track progress

## Build Profiles Available

- **local-dev**: Connects to local backend via ngrok
  ```bash
  npm run build:local
  # or
  npx eas-cli build --profile local-dev --platform android
  ```

- **cloud-dev**: Connects to cloud-dev backend
  ```bash
  npm run build:cloud
  # or
  npx eas-cli build --profile cloud-dev --platform android
  ```

- **production**: Connects to production backend
  ```bash
  npm run build:prod
  # or
  npx eas-cli build --profile production --platform android
  ```

## Important Notes

1. **Ngrok URL**: The local-dev profile uses ngrok URL. Make sure ngrok is running:
   ```bash
   ngrok http 5001
   ```
   Update `eas.json` if your ngrok URL changes.

2. **Keystore**: First build will generate a keystore. Keep it safe or let EAS manage it remotely.

3. **App Name**: Local builds will show as "Retail Scanner (Local)" to distinguish from cloud builds.

4. **Bundle ID**: Local builds use `com.dialadrink.retailscanner.local` so you can install both versions.

## After Build Completes

1. Download the APK from the EAS build page
2. Install on your Android device
3. The app will connect to your local backend via ngrok

