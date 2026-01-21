# Rebuild Instructions for Local Debug Variant

## Changes Made
1. **PendingOrdersActivity.kt**: Updated `onResume()` to always refresh orders
2. **OrderRepository.kt**: Updated pending orders filter to include status check for 'pending' or 'confirmed'

## Steps to Rebuild and See Changes

### Option 1: Using Android Studio (Recommended)
1. **Invalidate Caches and Restart**:
   - Go to `File` → `Invalidate Caches...`
   - Check all options
   - Click `Invalidate and Restart`

2. **Clean Project**:
   - Go to `Build` → `Clean Project`
   - Wait for it to complete

3. **Rebuild Project**:
   - Go to `Build` → `Rebuild Project`
   - Wait for build to complete

4. **Uninstall Old App** (Important):
   - On your device/emulator, uninstall the existing app
   - Or use: `adb uninstall com.dialadrink.driver.local`

5. **Run the App**:
   - Select `localDebug` variant from the build variants panel
   - Click `Run` (or press Shift+F10)

### Option 2: Using Command Line
```bash
cd driver-app-native

# Clean build
./gradlew clean

# Build localDebug variant
./gradlew assembleLocalDebug

# Install on connected device
./gradlew installLocalDebug

# Or uninstall first, then install
adb uninstall com.dialadrink.driver.local
./gradlew installLocalDebug
```

### Option 3: Force Rebuild (If changes still don't appear)
1. Delete `.gradle` folder in project root
2. Delete `app/build` folder
3. Invalidate caches in Android Studio
4. Rebuild project
5. Uninstall app from device
6. Reinstall

## Verify Changes
After rebuilding, verify the changes are included:
- Check that `PendingOrdersActivity.onResume()` always calls `refreshOrdersFromRepository()`
- Check that `OrderRepository.getPendingOrders()` filters include status check

## Troubleshooting
If changes still don't appear:
1. Check if you're running the correct variant (`localDebug`)
2. Verify the app package name matches: `com.dialadrink.driver.local`
3. Check build logs for any errors
4. Try a full clean rebuild
5. Restart Android Studio
