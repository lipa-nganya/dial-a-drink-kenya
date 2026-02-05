# Rebuild Local Build Variant with Latest Changes

## ✅ Changes Available

The following changes are in the codebase and will be included when you rebuild:

1. **PIN Protection for Cash at Hand Screen** ✅
   - Location: `CashAtHandActivity.kt`
   - Requires PIN verification before accessing

2. **PIN Protection for My Wallet Screen** ✅
   - Location: `MyWalletActivity.kt`
   - Requires PIN verification before accessing

3. **PIN Verification Dialog** ✅
   - Location: `PinVerificationDialog.kt`
   - Reusable dialog for PIN verification

4. **Balance Sheet Format for Cash Transactions** ✅
   - Location: `CashTransactionsFragment.kt`
   - Shows transactions in table format with balance

## 🔄 ngrok Status

**Current ngrok URL**: `https://homiest-psychopharmacologic-anaya.ngrok-free.dev`

This URL is already configured in `gradle.properties` as `LOCAL_API_BASE_URL`.

## 📱 Rebuild Local Build Variant

To see the changes, rebuild the local build variant:

```bash
cd driver-app-native

# Clean previous builds
./gradlew clean

# Build local debug APK
./gradlew assembleLocalDebug
```

**APK Location**: `app/build/outputs/apk/local/debug/app-local-debug.apk`

## 📲 Install on Device

```bash
# Install via ADB (if device connected)
adb install -r app/build/outputs/apk/local/debug/app-local-debug.apk

# Or manually transfer and install the APK
```

## ✅ Verify Changes

After installing:

1. **Open the app** (should show "Dial A Drink Driver (Local)")
2. **Login with PIN**
3. **Navigate to Cash at Hand** → Should prompt for PIN
4. **Navigate to My Wallet** → Should prompt for PIN
5. **Check Cash Transactions** → Should show balance sheet format

## 🔍 Testing PIN Protection

1. Open Cash at Hand or My Wallet
2. Enter your 4-digit PIN
3. PIN is valid for 5 minutes
4. After 5 minutes, you'll need to re-enter PIN

## 📝 Notes

- **ngrok URL**: Already configured in `gradle.properties`
- **Backend**: Make sure backend is running on port 5001
- **PIN**: Uses the same PIN as login
- **Session**: PIN verification expires after 5 minutes

## 🐛 Troubleshooting

If PIN dialog doesn't appear:
- Rebuild the app (changes are in source code)
- Clear app data and reinstall
- Check logs: `adb logcat | grep -i pin`

If ngrok URL changed:
- Update `gradle.properties` with new URL
- Rebuild the app
