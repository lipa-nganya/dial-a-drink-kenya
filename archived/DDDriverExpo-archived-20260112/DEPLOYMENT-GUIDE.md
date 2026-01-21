# Driver App Deployment (Expo + GCP backend)

## 1. Point the app at the new backend

The API client reads the base URL from environment variables or Expo config:

- Preferred: set `EXPO_PUBLIC_API_BASE_URL` to your Cloud Run HTTPS host **without** the trailing `/api`. Example:  
  `EXPO_PUBLIC_API_BASE_URL=https://dialadrink-backend-uc.a.run.app`
- Fallback: update `expo.extra.apiBaseUrl` in `app.json`.

During development you can still use the emulator defaults (`10.0.2.2`) or ngrok; just override the env var before running.

## 2. Local testing

```bash
cd DDDriverExpo
EXPO_PUBLIC_API_BASE_URL=https://dialadrink-backend-uc.a.run.app expo start
```

Use EAS Update or build previews to distribute the change:

```bash
EXPO_PUBLIC_API_BASE_URL=... eas update --branch production --message "Point driver app to Cloud Run backend"
```

## 3. Building new binaries (optional)

```bash
EXPO_PUBLIC_API_BASE_URL=... eas build --platform android --profile production
EXPO_PUBLIC_API_BASE_URL=... eas build --platform ios --profile production
```

## 4. Expo config reminder

`DDDriverExpo/src/services/api.js` now normalizes the base URL, appending `/api` automatically. Ensure your Cloud Run routing matches (default Express install uses `/api/...` routes).


