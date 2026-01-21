# Push Notifications Not Working in Standalone Builds - Solution

## Problem
Push notifications work in Expo Go but not in standalone production builds (APK).

## Root Cause
For standalone builds, Expo requires FCM (Firebase Cloud Messaging) credentials to be properly configured. Expo Go has these credentials built-in, but standalone builds need them to be explicitly set up.

## Solution

### Step 1: Upload FCM Credentials to Expo (REQUIRED)

1. **Get your FCM Server Key from Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project (or create one)
   - Go to Project Settings → Cloud Messaging
   - Copy the "Server key" (legacy) or create a new key

2. **Upload FCM credentials to Expo:**
   ```bash
   cd DDDriverExpo
   eas credentials
   ```
   - Select: Android
   - Select: Push Notifications (FCM)
   - Choose: Set up new credentials
   - Paste your FCM Server Key when prompted

3. **Add SHA-1 Fingerprint to Firebase:**
   - Get your app's SHA-1 fingerprint from Expo dashboard or by running:
     ```bash
     eas credentials
     ```
     Select Android → View credentials → Copy SHA-1
   - Go to Firebase Console → Project Settings → Your Android App
   - Add the SHA-1 fingerprint

### Step 2: Verify Code Configuration

The code has been updated to:
- Use `projectId` from `Constants.expoConfig.extra.eas.projectId`
- Remove `applicationId` parameter (Expo handles this automatically)
- Add better error handling and logging

### Step 3: Rebuild the App

After uploading FCM credentials, you MUST rebuild the app:

```bash
cd DDDriverExpo
eas build --platform android --profile local-dev
```

**IMPORTANT**: FCM credentials are embedded at build time. OTA updates cannot add them.

### Step 4: Verify Push Token Format

After rebuilding and installing:
1. Open the app
2. Check logs for: `✅ Push token obtained: ExponentPushToken[...]`
3. Verify the token starts with `ExponentPushToken[`
4. Check backend logs to confirm token was saved

## Why This Happens

- **Expo Go**: Has FCM credentials pre-configured by Expo
- **Standalone Builds**: Need FCM credentials to be explicitly uploaded via `eas credentials`
- **The Difference**: Expo Go uses Expo's shared FCM project, standalone builds use your own FCM project

## Testing

1. Rebuild app with FCM credentials
2. Install the new APK
3. Open app and grant notification permissions
4. Check logs for push token
5. Send test notification from admin panel
6. Verify notification is received

## Additional Notes

- The `google-services.json` file is NOT needed - Expo handles this automatically for EAS builds
- The `projectId` in `app.json` must match your Expo project
- Push notifications will NOT work until FCM credentials are uploaded and app is rebuilt


