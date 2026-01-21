# Enable Cloud Messaging API (Legacy) for FCM

## Problem
The Cloud Messaging API (Legacy) is disabled in Firebase Console, and you can't access it.

## Solution 1: Enable via Google Cloud Console (Recommended)

1. **Go to Google Cloud Console:**
   - Open: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=drink-suite
   - Or navigate: Google Cloud Console → APIs & Services → Library → Search "Firebase Cloud Messaging API"

2. **Enable the API:**
   - Click on "Firebase Cloud Messaging API"
   - Click the "ENABLE" button
   - Wait for it to enable (usually takes a few seconds)

3. **Get the Server Key:**
   - Go back to: https://console.firebase.google.com/project/drink-suite/settings/cloudmessaging
   - The "Server key" should now be visible under "Cloud Messaging API (Legacy)"

## Solution 2: Use google-services.json (Alternative)

If you can't enable the Legacy API, you can use `google-services.json` instead:

1. **Get google-services.json:**
   - Go to: https://console.firebase.google.com/project/drink-suite/settings/general
   - Scroll to "Your apps" section
   - Find or create Android app with package: `com.dialadrink.driver`
   - Download `google-services.json`

2. **Place in project:**
   ```bash
   # Copy google-services.json to DDDriverExpo directory
   cp ~/Downloads/google-services.json DDDriverExpo/
   ```

3. **Update app.json:**
   Add this to your `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "googleServicesFile": "./google-services.json"
       }
     }
   }
   ```

4. **Build:**
   Expo will automatically use `google-services.json` during build.

## Solution 3: Enable via gcloud CLI

If the web console doesn't work, use command line:

```bash
# Install gcloud CLI if not installed
# macOS: brew install google-cloud-sdk

# Login
gcloud auth login

# Set project
gcloud config set project drink-suite

# Enable FCM API
gcloud services enable fcm.googleapis.com

# Also enable the legacy API
gcloud services enable fcm.googleapis.com --enable-apis
```

## Verify API is Enabled

Check if API is enabled:
```bash
gcloud services list --enabled --project=drink-suite | grep fcm
```

You should see:
- `fcm.googleapis.com` (Firebase Cloud Messaging API)


