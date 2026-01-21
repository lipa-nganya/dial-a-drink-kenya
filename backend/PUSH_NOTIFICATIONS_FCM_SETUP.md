# Push Notifications: Native FCM Setup

## Overview

The driver app uses native FCM (Firebase Cloud Messaging) for push notifications. The backend supports native FCM tokens directly.

## Current Implementation

- **App sends**: Native FCM tokens
- **Backend sends to**: Firebase Cloud Messaging directly
- **Result**: Works with native Android app

## Backend Support

The backend supports:
- ✅ Native FCM tokens
- ✅ Detects token type automatically
- ✅ Routes FCM tokens directly to FCM
- ✅ Routes APNs tokens directly to APNs (for future iOS support)

## Configuration

### In the App:
   - Uses native FCM SDK
   - Sends FCM tokens to backend via `/api/drivers/:id/push-token` endpoint
   - Token type is automatically detected as "native"

### In the Backend:
   - ✅ Backend supports native FCM tokens
   - ✅ Automatically routes to FCM service
   - ✅ Firebase Admin SDK configured with service account

## Firebase Setup

1. **Firebase Project:**
   - Create Firebase project
   - Get service account credentials
   - Set environment variables:
     ```
     FIREBASE_PROJECT_ID=your-project-id
     FIREBASE_PRIVATE_KEY=your-private-key
     FIREBASE_CLIENT_EMAIL=your-service-account-email
     ```

2. **Android App:**
   - Add `google-services.json` to `driver-app-native/app/` directory
   - Configure Firebase in Android Studio

## Testing

1. Send test notification
2. Verify it's routed to FCM (check logs)
3. Verify notification is received on device

## Current Status

- ✅ Backend supports native FCM
- ✅ Native Android app sends FCM tokens
- ✅ Firebase Admin SDK configured
