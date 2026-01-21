# Get google-services.json for FCM

## Why google-services.json?

The Cloud Messaging API (Legacy) has been deprecated by Google (as of June 2024). We need to use `google-services.json` instead, which is the modern way to configure FCM.

## Steps to Get google-services.json

### Step 1: Go to Firebase Console

Open: https://console.firebase.google.com/project/drink-suite/settings/general

### Step 2: Find or Create Android App

1. Scroll to **"Your apps"** section
2. Look for an Android app with package name: `com.dialadrink.driver`
3. **If the app doesn't exist:**
   - Click **"Add app"** → Select **Android** icon
   - **Package name**: `com.dialadrink.driver`
   - **App nickname**: DD Driver (optional)
   - **Debug signing certificate SHA-1**: (optional, can add later)
   - Click **"Register app"**

### Step 3: Download google-services.json

1. After registering the app, you'll see a **"Download google-services.json"** button
2. Click it to download the file
3. **Save it to**: `DDDriverExpo/google-services.json`

### Step 4: Verify File Location

The file should be at:
```
DDDriverExpo/google-services.json
```

### Step 5: Rebuild the App

After placing `google-services.json` in the project:

```bash
cd DDDriverExpo
eas build --platform android --profile local-dev
```

Expo will automatically use `google-services.json` during the build process.

## What's Already Done

✅ `app.json` has been updated to reference `google-services.json`:
```json
"android": {
  "googleServicesFile": "./google-services.json"
}
```

## Important Notes

- **Package name must match**: The package name in `google-services.json` must match `com.dialadrink.driver` from `app.json`
- **File location**: `google-services.json` must be in the `DDDriverExpo/` directory (project root)
- **No Server Key needed**: With `google-services.json`, you don't need the deprecated FCM Server Key

## Verify Setup

After downloading and placing the file, verify:

```bash
cd DDDriverExpo
ls -la google-services.json
```

You should see the file listed.


