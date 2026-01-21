# Configure FCM Credentials for Expo

## Step 1: Get FCM Server Key from Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **drink-suite** (project ID from service account)
3. Click the gear icon ⚙️ next to "Project Overview"
4. Select **Project Settings**
5. Go to the **Cloud Messaging** tab
6. Under **Cloud Messaging API (Legacy)**, find **Server key**
7. Copy the Server key (it's a long string)

## Step 2: Upload FCM Server Key to Expo

Run this command:

```bash
cd DDDriverExpo
eas credentials
```

Then:
1. Select **Android**
2. Select **Push Notifications (FCM)**
3. Choose **Set up new credentials** or **Update existing credentials**
4. Paste the FCM Server Key when prompted
5. Confirm the upload

## Step 3: Verify Credentials

After uploading, verify with:

```bash
eas credentials --platform android
```

You should see FCM credentials listed.

## Step 4: Rebuild the App

After uploading FCM credentials, rebuild the app:

```bash
eas build --platform android --profile local-dev
```

## Alternative: Using google-services.json

If you prefer to use `google-services.json`:

1. In Firebase Console → Project Settings → Your apps
2. Find or create an Android app with package name: `com.dialadrink.driver`
3. Download `google-services.json`
4. Place it in `DDDriverExpo/` directory
5. Expo will automatically use it during build

## Current Firebase Project Info

- **Project ID**: drink-suite
- **Service Account**: firebase-adminsdk-fbsvc@drink-suite.iam.gserviceaccount.com
- **Package Name**: com.dialadrink.driver


