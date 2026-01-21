# Expo Driver App - Setup Guide

## ✅ Project Created

The Expo driver app has been created at: `/Users/maria/dial-a-drink/DDDriverExpo`

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/maria/dial-a-drink/DDDriverExpo
npm install
```

### 2. Test with Expo Go (Easiest)

1. **Install Expo Go app** on your phone:
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS: https://apps.apple.com/app/expo-go/id982107779

2. **Start the development server**:
   ```bash
   npx expo start
   ```

3. **Scan the QR code** with:
   - Android: Expo Go app
   - iOS: Camera app (then tap the notification)

4. **The app will load** on your phone!

### 3. Build APK (For Distribution)

#### Option A: Build Locally (Requires Android Studio)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo (create free account at expo.dev)
eas login

# Configure build
eas build:configure

# Build APK
eas build --platform android --profile preview
```

#### Option B: Build in Cloud (Easiest - Recommended)

1. **Create Expo account** (free): https://expo.dev

2. **Login**:
   ```bash
   npx expo login
   ```

3. **Build APK**:
   ```bash
   eas build --platform android --profile preview
   ```

4. **Download APK** when build completes (link sent via email)

#### Option C: Use Expo Application Services (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build APK
eas build --platform android --profile preview
```

## Current Configuration

- **API URL**: Already configured to use ngrok: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev/api`
- **App Name**: DD Driver
- **Package**: com.dialadrink.driver

## Testing

### Test with Expo Go (No APK needed!)

1. Make sure backend is running: `cd backend && npm start`
2. Make sure ngrok is running: `ngrok http 5001`
3. Start Expo: `npx expo start`
4. Scan QR code with Expo Go app
5. Test login flow!

### Build APK for Distribution

Use `eas build` command above.

## Important Files

- `App.js` - Main app component with navigation
- `src/screens/` - All screen components
- `src/services/api.js` - API configuration (already set to ngrok)
- `app.json` - Expo configuration

## Next Steps

1. **Test with Expo Go first** (fastest way to test)
2. **Add driver in admin dashboard** (http://localhost:3001/drivers)
3. **Test login flow** on your phone
4. **Build APK** when ready for distribution

## Troubleshooting

### "Cannot connect to backend"
- Check backend is running: `curl http://localhost:5001/api/health`
- Check ngrok is running
- API URL is configured in `src/services/api.js`

### "Expo Go can't find project"
- Make sure phone and computer are on same WiFi
- Or use tunnel mode: `npx expo start --tunnel`

### "Build failed"
- Make sure you're logged in: `npx expo login`
- Check internet connection (builds happen in cloud)

## Commands Reference

```bash
# Start development server
npx expo start

# Start with tunnel (for different networks)
npx expo start --tunnel

# Build APK (requires EAS account)
eas build --platform android --profile preview

# Check build status
eas build:list

# Download latest build
eas build:download
```

## Benefits of Expo

✅ No Android Studio setup needed
✅ Build APK in the cloud
✅ Test instantly with Expo Go
✅ Easy updates with OTA
✅ Simple deployment

Enjoy! 🚀

























