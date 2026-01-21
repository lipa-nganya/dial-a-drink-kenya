# Get the Correct google-services.json File

## ⚠️ Important: Two Different Files

Firebase has **two different JSON files**:

1. **Service Account JSON** (what you downloaded)
   - Used for: Backend/server (Firebase Admin SDK)
   - Contains: `type: "service_account"`
   - Location: Backend already has this configured
   - ❌ **NOT what we need for the Android app**

2. **google-services.json** (what we need)
   - Used for: Android/iOS client apps
   - Contains: `project_info` and `client` sections
   - Location: `DDDriverExpo/google-services.json`
   - ✅ **This is what we need**

## Steps to Get the Correct File

### Step 1: Go to Firebase Console

Open: https://console.firebase.google.com/project/drink-suite/settings/general

### Step 2: Find or Create Android App

1. Scroll to **"Your apps"** section
2. Look for an Android app with package name: `com.dialadrink.driver`

**If the app doesn't exist:**
- Click **"Add app"** → Select **Android** icon (green robot)
- **Package name**: `com.dialadrink.driver` (must match exactly)
- **App nickname**: DD Driver (optional)
- **Debug signing certificate SHA-1**: (optional, can skip for now)
- Click **"Register app"**

### Step 3: Download google-services.json

1. After registering (or if app already exists), you'll see a page with:
   - "Add Firebase SDK" instructions
   - **"Download google-services.json"** button (usually at the top)

2. Click **"Download google-services.json"**

3. The file will download to your Downloads folder

### Step 4: Verify the File Structure

The correct file should look like this:

```json
{
  "project_info": {
    "project_number": "...",
    "project_id": "drink-suite",
    "storage_bucket": "..."
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "...",
        "android_client_info": {
          "package_name": "com.dialadrink.driver"
        }
      },
      "oauth_client": [...],
      "api_key": [...],
      "services": {...}
    }
  ]
}
```

**Key differences:**
- ✅ Has `project_info` section
- ✅ Has `client` array
- ✅ Contains `package_name: "com.dialadrink.driver"`
- ❌ Does NOT have `type: "service_account"`

### Step 5: Place the File

```bash
cp ~/Downloads/google-services.json /Users/maria/dial-a-drink/DDDriverExpo/
```

### Step 6: Verify

```bash
cd DDDriverExpo
./setup-google-services.sh
```

You should see:
- ✅ Package name matches: `com.dialadrink.driver`

## Summary

- **Backend**: Uses service account JSON (already configured)
- **Android App**: Needs `google-services.json` (download from Firebase Console → Your apps → Android app)


