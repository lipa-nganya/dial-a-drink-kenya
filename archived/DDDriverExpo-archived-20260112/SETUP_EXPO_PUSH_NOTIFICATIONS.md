# Setup Push Notifications via Expo Service (Option 1)

This is the **free** option that uses Expo's push notification service. Expo acts as a proxy and forwards notifications to FCM.

## Step 1: Create Firebase Project (Free)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project: **drink-suite**
3. If adding Firebase to existing Google Cloud project:
   - Select "drink-suite" from dropdown
   - Click "Continue"
   - Disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Add Android App to Firebase

1. In Firebase Console, click **Add app** → **Android**
2. **Android package name**: `com.dialadrink.driver`
3. **App nickname** (optional): "Dial A Drink Driver"
4. Click **Register app**
5. **Skip** downloading `google-services.json` (Expo handles this)

## Step 3: Get FCM Server Key

1. In Firebase Console, go to **Project Settings** (gear icon ⚙️)
2. Go to **Cloud Messaging** tab
3. Under **Cloud Messaging API (Legacy)**, find **Server key**
4. **Copy the Server key** (it's a long string starting with `AAAA...`)
5. **Note your Sender ID**: `910510650031` (for reference)

**Note**: If you don't see "Server key", you may need to:
- Enable Cloud Messaging API in Google Cloud Console
- Or use the newer "Cloud Messaging API (V1)" - but Expo currently uses the legacy key

**Your Project Details:**
- **FCM Sender ID**: `910510650031`
- **Project**: drink-suite
- **Android Package**: `com.dialadrink.driver`

## Step 4: Upload FCM Server Key to Expo

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo** (if not already logged in):
   ```bash
   eas login
   ```

3. **Upload FCM credentials**:
   ```bash
   cd DDDriverExpo
   eas credentials
   ```

4. **Follow the prompts**:
   - Select: **Android**
   - Select: **Push Notifications (FCM)**
   - Choose: **Set up new credentials** or **Update existing credentials**
   - When prompted for **FCM Server Key**, paste the Server key you copied
   - Expo will save the credentials

## Step 5: Get SHA-1 Fingerprint (Required for FCM)

1. **Get your app's SHA-1 fingerprint**:
   ```bash
   cd DDDriverExpo
   eas credentials
   ```
   - Select: **Android**
   - Select: **View credentials**
   - Copy the **SHA-1** fingerprint

2. **Add SHA-1 to Firebase**:
   - Go back to Firebase Console
   - Go to **Project Settings** → **Your apps**
   - Click on your Android app (`com.dialadrink.driver`)
   - Scroll down to **SHA certificate fingerprints**
   - Click **Add fingerprint**
   - Paste your SHA-1 fingerprint
   - Click **Save**

## Step 6: Rebuild the App

**IMPORTANT**: FCM credentials are embedded at build time. You MUST rebuild the app after uploading credentials.

```bash
cd DDDriverExpo
eas build --platform android --profile local-dev
```

This will:
- Embed the FCM credentials in the build
- Allow push notifications to work in standalone builds
- Take 10-20 minutes

## Step 7: Test Push Notifications

1. **Install the new APK** on your device
2. **Open the app** and log in
3. **Check logs** for: `✅ Push token obtained: ExponentPushToken[...]`
4. **Send test notification** from admin panel
5. **Verify notification is received**

## How It Works

- **Expo Go**: Uses Expo's shared FCM project (works automatically)
- **Standalone builds**: Uses your FCM credentials (uploaded via `eas credentials`)
- **Backend**: Sends to Expo's push notification service (already configured)
- **Expo service**: Forwards to FCM using your credentials

## Troubleshooting

### Error: "No FCM credentials found"
- Make sure you uploaded credentials via `eas credentials`
- Verify you rebuilt the app after uploading credentials

### Error: "Device not registered"
- Check that SHA-1 fingerprint is added to Firebase
- Verify the Android package name matches: `com.dialadrink.driver`

### Notifications not received
- Check that the app has notification permissions
- Verify the push token is saved in the backend
- Check backend logs for push notification attempts

## Cost

✅ **FREE** - No Firebase Admin SDK needed
✅ **FREE** - Expo handles FCM forwarding
✅ **FREE** - Only requires FCM Server Key (free from Firebase)

## Next Steps

After rebuilding:
1. The app will get Expo push tokens (works with your FCM credentials)
2. Backend sends to Expo service (already configured)
3. Expo forwards to FCM using your credentials
4. Push notifications work in standalone builds! 🎉

