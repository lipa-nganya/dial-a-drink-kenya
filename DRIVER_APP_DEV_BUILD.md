# 📱 Driver App Dev Build - Deployment Instructions

## 🌿 Branch Information

**Development builds** should be built from the **`develop`** branch:
- Uses development API: `https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api`
- Package ID: `com.dialadrink.driver.dev`
- Build variant: `developmentDebug` or `developmentRelease`

**Production builds** should be built from the **`main`** branch:
- Uses production API: (Production backend URL)
- Package ID: `com.dialadrink.driver`
- Build variant: `productionRelease`

## ✅ Changes Committed

All changes have been pushed to GitHub:
- PIN reset flow implementation
- Socket service improvements
- Credit limit logic updates
- OTP verification enhancements

## 🚀 Build Development APK

### Option 1: Using Android Studio (Recommended)

1. **Open Project**
   ```bash
   cd /Users/maria/dial-a-drink/driver-app-native
   ```
   Open in Android Studio: File → Open → Select `driver-app-native` folder

2. **Select Build Variant**
   - Open **Build Variants** panel (View → Tool Windows → Build Variants)
   - Select `developmentDebug` variant

3. **Build and Install**
   - Connect your Android device via USB
   - Enable USB Debugging on device
   - Click **Run** (▶️) button
   - Select your device
   - App will build and install automatically

   **Output APK Location:**
   ```
   app/build/outputs/apk/development/debug/app-development-debug.apk
   ```

### Option 2: Using Gradle Command Line

If `gradlew` exists:
```bash
cd /Users/maria/dial-a-drink/driver-app-native
chmod +x gradlew
./gradlew assembleDevelopmentDebug
```

Then install:
```bash
adb install app/build/outputs/apk/development/debug/app-development-debug.apk
```

## 📋 What's Included in This Build

### New Features:
1. **PIN Reset Flow**
   - Enter phone number → Send OTP → Verify OTP → Set new PIN → Login
   - Complete flow implemented with validation

2. **Socket Updates**
   - Real-time updates on Active Orders screen
   - Real-time updates on Order Detail screen
   - Multiple socket handlers support

3. **Credit Limit Logic**
   - Allow order updates if pending cash submission brings balance to 0
   - Enhanced credit limit checking

4. **OTP Improvements**
   - Better normalization and comparison
   - Enhanced logging for debugging
   - PIN reset OTP sending

## 🔍 Verification Steps

After installing the dev build:

1. **Test PIN Reset:**
   - Open app → Login screen → Click "Forgot PIN?"
   - Enter phone number → Send OTP
   - Verify OTP → Set new PIN
   - Confirm PIN matches → Should login automatically

2. **Test Socket Updates:**
   - Open Active Orders screen
   - Have admin update an order status
   - Order should update in real-time without refresh

3. **Test Credit Limit:**
   - If cash at hand exceeds limit but has pending submission that clears balance
   - Should allow order updates

## 📦 APK Details

- **Variant**: `developmentDebug`
- **Package ID**: `com.dialadrink.driver.dev`
- **App Name**: "Dial A Drink Driver (Dev)"
- **API URL**: Uses `DEV_API_BASE_URL` from `gradle.properties`

## ⚠️ Notes

- This is a **debug build** - includes debugging symbols
- Can be installed side-by-side with production build
- Uses development API endpoint
- All features are enabled and ready for testing

## 🐛 Troubleshooting

**Build fails?**
- Ensure Android Studio has synced Gradle files
- File → Sync Project with Gradle Files
- Clean project: Build → Clean Project
- Rebuild: Build → Rebuild Project

**APK not installing?**
- Uninstall existing dev build first: `adb uninstall com.dialadrink.driver.dev`
- Ensure USB debugging is enabled
- Check device is recognized: `adb devices`

**Wrong API URL?**
- Check `gradle.properties` file
- Verify `DEV_API_BASE_URL` is set correctly
- Rebuild after changing properties
