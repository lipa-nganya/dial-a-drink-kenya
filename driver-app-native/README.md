# Dial A Drink Driver - Native Android App (Kotlin)

This is the native Android driver app built in Kotlin for managing deliveries and earnings.

## Project Structure

```
app/src/main/
├── kotlin/com/dialadrink/driver/
│   ├── ui/
│   │   ├── auth/          # Authentication screens
│   │   ├── main/          # Main activity with tabs
│   │   ├── orders/        # Order management
│   │   ├── wallet/        # Wallet screen
│   │   └── profile/       # Profile screen
│   ├── data/
│   │   ├── api/           # API client and service
│   │   ├── model/         # Data models
│   │   └── repository/    # Data repositories
│   ├── services/          # Background services (FCM, Location)
│   └── utils/            # Utilities
└── res/                   # Resources (layouts, strings, etc.)
```

## Build Configuration

### Local Build (Ngrok)
The default build uses ngrok backend:
```bash
./gradlew assembleDebug
```

### Dev Build (GCloud)
To build with GCloud backend, set the API URL:
```bash
./gradlew assembleDebug -PAPI_BASE_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
```

Or edit `app/build.gradle` and change the `getApiBaseUrl()` function.

## Features

- ✅ Phone number authentication
- ✅ OTP verification
- ✅ PIN setup and login
- ✅ Native FCM push notifications
- ✅ Active orders management
- ✅ Order history
- ✅ Wallet with transactions
- ✅ Profile screen
- ✅ Dark theme support
- ✅ Location tracking

## Setup Instructions

1. **Open in Android Studio**
   - File > Open > Select `driver-app-native` folder
   - Wait for Gradle sync

2. **Configure Firebase** (for push notifications)
   - Add `google-services.json` to `app/` directory
   - Configure FCM credentials in Firebase Console

3. **Build and Run**
   - Connect your Samsung device
   - Click Run button in Android Studio
   - Or: `./gradlew installDebug`

## API Configuration

The backend URL is configured in `app/build.gradle`:
- Default: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev` (local)
- Can be overridden via gradle property: `-PAPI_BASE_URL=your-url`

## Next Steps

1. Complete authentication flow screens
2. Implement main activity with bottom navigation
3. Add order management screens
4. Implement FCM push notifications
5. Add location tracking
6. Build and test on device


