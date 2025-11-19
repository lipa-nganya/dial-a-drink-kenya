# Retail Scanner App

Android app for scanning barcodes and managing inventory for Dial A Drink POS system.

## Setup

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start local backend server:**
   ```bash
   cd ../backend
   node server.js
   ```

3. **For physical device testing, set up ngrok:**
   ```bash
   ngrok http 5001
   ```
   Then update `eas.json` local-dev profile with your ngrok URL:
   ```json
   "EXPO_PUBLIC_API_BASE_URL": "https://your-ngrok-url.ngrok-free.dev"
   ```

4. **Run on device:**
   ```bash
   npm start
   ```
   Then scan QR code with Expo Go app, or build APK (see below).

### Building APK

#### Local Development Build

Build APK that connects to local server (via ngrok):

```bash
# Make sure your ngrok URL is set in eas.json local-dev profile
npx eas build --profile local-dev --platform android
```

#### Cloud Development Build

Build APK that connects to cloud-dev backend:

```bash
npx eas build --profile cloud-dev --platform android
```

#### Production Build

```bash
npx eas build --profile production --platform android
```

## Build Profiles

- **local-dev**: Connects to local backend (via ngrok). Bundle ID: `com.dialadrink.retailscanner.local`
- **cloud-dev**: Connects to cloud-dev backend. Bundle ID: `com.dialadrink.retailscanner`
- **production**: Connects to production backend. Bundle ID: `com.dialadrink.retailscanner`

## Features

1. **Add Barcode & Stock Mode:**
   - Scan barcode
   - Search and select inventory item
   - Attach barcode to item
   - Set stock quantity

2. **POS Scan Mode:**
   - Scan items at point of sale
   - Items automatically added to cart
   - Inventory decreased when order completed

## API Configuration

The app uses `app.config.js` to dynamically set the API URL based on build profile:
- Local dev: Uses `EXPO_PUBLIC_API_BASE_URL` from `eas.json` or ngrok URL
- Cloud dev/Production: Uses cloud backend URL

## Deep Linking

The app supports deep linking from the admin POS page:
- Scheme: `retailscanner://`
- POS Scan: `retailscanner://pos-scan`

