# Creating Firebase Credentials for Push Notifications

## Step-by-Step Guide

### Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with the account that has access to this project
3. Select the project: **drink-suite** (or the project where your backend is deployed)

### Step 2: Enable Firebase for Your Project

1. In Google Cloud Console, go to **Firebase Console**:
   - Click the hamburger menu (☰) → **Firebase** → **Go to Firebase Console**
   - OR visit: https://console.firebase.google.com/

2. **Add Firebase to your Google Cloud project:**
   - If you see "Add project" or "Get started", click it
   - Select your existing Google Cloud project: **drink-suite**
   - Click "Continue"
   - **Disable Google Analytics** (not needed for FCM) or enable if you want
   - Click "Create project"
   - Wait for Firebase to be set up (1-2 minutes)

### Step 3: Add Android App to Firebase

1. In Firebase Console, click **Add app** → **Android**
2. **Android package name**: `com.dialadrink.driver`
3. **App nickname** (optional): "Dial A Drink Driver"
4. **Debug signing certificate SHA-1** (optional for now, can add later)
5. Click **Register app**

### Step 4: Create Service Account for Backend

1. In Firebase Console, go to **Project Settings** (gear icon ⚙️)
2. Go to **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** in the dialog
5. **IMPORTANT**: A JSON file will download - **SAVE THIS FILE SECURELY**
   - This file contains your service account credentials
   - **DO NOT commit this file to git**
   - **DO NOT share this file publicly**

### Step 5: Configure Backend Environment Variables

You have two options:

#### Option A: Use Service Account JSON File (Recommended for Local)

1. Save the downloaded JSON file to: `backend/firebase-service-account.json`
2. Add to `.gitignore`:
   ```
   backend/firebase-service-account.json
   ```
3. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/backend/firebase-service-account.json
   ```

#### Option B: Use Environment Variables (Recommended for Cloud Run)

1. Open the downloaded JSON file
2. Extract these values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

3. Add to your backend `.env` file or Cloud Run environment variables:
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   ```

### Step 6: Verify Configuration

1. Restart your backend server
2. Check logs for:
   ```
   ✅ Firebase Admin SDK initialized for native FCM push notifications
   ```
   OR
   ```
   ⚠️ Firebase Admin SDK not initialized - FCM credentials not found
   ```

### Step 7: Test Push Notifications

1. Open the driver app (standalone build)
2. Log in and check logs for: `✅ Using native FCM/APNs token for standalone build`
3. Send a test push notification from admin panel
4. Check backend logs for: `📤 Sending FCM notification to token: ...`
5. Verify notification is received on device

## Security Notes

- **Never commit** the service account JSON file to git
- **Never share** the private key publicly
- **Restrict** the service account permissions if possible (Firebase Admin SDK requires full access)
- **Rotate** credentials if they're ever exposed

## Troubleshooting

### Error: "Firebase Admin SDK not initialized"
- Check that environment variables are set correctly
- Verify the JSON file path is correct
- Check that the private key includes `\n` characters (not actual newlines)

### Error: "Permission denied"
- Ensure the service account has "Firebase Admin SDK Administrator Service Agent" role
- Check that Firebase is enabled for your project

### Error: "Invalid token"
- Verify the app is getting native FCM tokens
- Check that the Android package name matches: `com.dialadrink.driver`

## Next Steps

After setting up Firebase credentials:
1. The backend will automatically detect FCM tokens and route them correctly
2. Push notifications will work for standalone builds
3. Native Android app uses native FCM tokens


