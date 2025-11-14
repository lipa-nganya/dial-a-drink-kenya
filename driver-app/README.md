# DDDriver - Dial A Drink Driver App

A React Native Android app for drivers to authenticate and manage deliveries.

## Features

- Phone number authentication with OTP
- PIN setup and confirmation
- PIN-based login for future sessions
- Driver dashboard (placeholder for future features)

## Setup

### Prerequisites

- Node.js 18+
- React Native development environment
- Android Studio (for building APK)

### Installation

1. Install dependencies:
```bash
cd driver-app
npm install
```

2. Install pods (iOS only):
```bash
cd ios && pod install && cd ..
```

### Configuration

#### For Android Emulator

The app is configured to use `http://10.0.2.2:5001/api` by default, which maps to `localhost:5001` on your host machine.

#### For Physical Device (via Ngrok)

1. Update `src/services/api.js`:
```javascript
const getBaseURL = () => {
  return 'https://your-ngrok-url.ngrok-free.dev/api';
};
```

2. Or use your computer's local IP address:
```javascript
const getBaseURL = () => {
  return 'http://192.168.1.XXX:5001/api'; // Replace with your local IP
};
```

#### For Physical Device (via Local Network)

1. Find your computer's local IP address:
   - Mac/Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`

2. Update `src/services/api.js`:
```javascript
const getBaseURL = () => {
  return 'http://YOUR_LOCAL_IP:5001/api'; // e.g., http://192.168.1.100:5001/api
};
```

3. Make sure your phone and computer are on the same WiFi network
4. Make sure your backend server is accessible from your local network (check firewall settings)

## Running the App

### Development Mode

```bash
# Start Metro bundler
npm start

# Run on Android
npm run android
```

### Building APK

#### Debug APK (for testing)

```bash
npm run build:apk-debug
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK (for production)

1. Generate a signing key (first time only):
```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore dddriver-release-key.keystore -alias dddriver-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `android/gradle.properties`:
```properties
DDDRIVER_RELEASE_STORE_FILE=dddriver-release-key.keystore
DDDRIVER_RELEASE_KEY_ALIAS=dddriver-key-alias
DDDRIVER_RELEASE_STORE_PASSWORD=your-store-password
DDDRIVER_RELEASE_KEY_PASSWORD=your-key-password
```

3. Update `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('DDDRIVER_RELEASE_STORE_FILE')) {
                storeFile file(DDDRIVER_RELEASE_STORE_FILE)
                storePassword DDDRIVER_RELEASE_STORE_PASSWORD
                keyAlias DDDRIVER_RELEASE_KEY_ALIAS
                keyPassword DDDRIVER_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

4. Build release APK:
```bash
npm run build:apk
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Backend Setup

The backend needs to have:

1. Driver routes (already added):
   - `GET /api/drivers/phone/:phoneNumber` - Get driver by phone
   - `PATCH /api/drivers/phone/:phoneNumber/activity` - Update driver activity

2. OTP routes (already exists):
   - `POST /api/auth/send-otp` - Send OTP
   - `POST /api/auth/verify-otp` - Verify OTP

## Communication with Local Server

### Android Emulator
- Use `10.0.2.2` instead of `localhost` (already configured)
- This is the special IP that maps to `localhost` on the host machine

### Physical Device - Option 1: Ngrok
1. Start ngrok: `ngrok http 5001`
2. Copy the HTTPS URL
3. Update `src/services/api.js` with the ngrok URL

### Physical Device - Option 2: Local Network IP
1. Find your computer's local IP (e.g., `192.168.1.100`)
2. Update `src/services/api.js` with your local IP
3. Ensure phone and computer are on the same WiFi
4. Check firewall allows connections on port 5001

### Physical Device - Option 3: USB Debugging + ADB Port Forwarding
```bash
adb reverse tcp:5001 tcp:5001
```
Then use `localhost:5001` in the app.

## Troubleshooting

### "Network Error" or "Connection Refused"
- Check backend server is running on port 5001
- Verify API URL configuration in `src/services/api.js`
- For physical device, ensure correct network setup

### "Driver not found"
- Make sure driver is added in admin dashboard first
- Verify phone number format matches (should be stored as digits only)

### Build Errors
- Run `cd android && ./gradlew clean` before building
- Ensure all dependencies are installed: `npm install`

## File Structure

```
driver-app/
├── src/
│   ├── screens/
│   │   ├── PhoneNumberScreen.js
│   │   ├── OtpVerificationScreen.js
│   │   ├── PinSetupScreen.js
│   │   ├── PinConfirmScreen.js
│   │   ├── PinLoginScreen.js
│   │   └── HomeScreen.js
│   ├── services/
│   │   └── api.js
│   └── components/
├── android/
├── App.js
└── package.json
```















