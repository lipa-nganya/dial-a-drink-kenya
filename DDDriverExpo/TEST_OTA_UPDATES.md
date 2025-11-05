# Testing OTA Updates Guide

## Quick Test Steps

### 1. Publish a Test Update
```bash
cd DDDriverExpo
./publish-update.sh production "Test update - checking OTA functionality"
```

### 2. Verify Update Was Published
```bash
# Check update list
eas update:list --channel production

# You should see your update in the list with:
# - Update ID
# - Channel (production)
# - Message
# - Created date
# - Runtime version
```

### 3. Test on Driver App

#### Method 1: Automatic Check (Recommended)
1. **Make sure you have a production build installed** (not development build)
2. **Force close the driver app completely**
   - Android: Settings → Apps → DD Driver → Force Stop
   - Or use Recent Apps → Swipe away the app
3. **Open the driver app again**
4. **Watch the console logs** (if connected via USB/ADB):
   ```bash
   # Android
   adb logcat | grep -i "expo\|update"
   
   # Or use Expo Dev Tools
   ```
5. **What to look for:**
   - `🔄 Checking for OTA updates...`
   - `✅ Update available! Downloading...`
   - `✅ Update downloaded! Reloading app...`
   - App will automatically reload with the new code

#### Method 2: Manual Check (For Testing)
If you want to test without closing the app, you can add a temporary debug button:

```javascript
// In HomeScreen.js or App.js, add a test button:
import * as Updates from 'expo-updates';

const checkForUpdate = async () => {
  try {
    if (__DEV__) {
      Alert.alert('Dev Mode', 'Updates only work in production builds');
      return;
    }
    
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      Alert.alert('Update Available', 'Downloading...');
      await Updates.fetchUpdateAsync();
      Alert.alert('Update Downloaded', 'Reloading app...');
      await Updates.reloadAsync();
    } else {
      Alert.alert('No Update', 'App is up to date');
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

### 4. Verify Update Applied

**Check the update worked:**
- ✅ App version/behavior matches your changes
- ✅ Console logs show update was downloaded
- ✅ New features/code changes are visible
- ✅ Check `eas update:list` shows the update was downloaded

**How to know it worked:**
- App will reload automatically after update download
- You'll see your changes immediately
- Check console for update confirmation logs

## Troubleshooting

### Update Not Appearing

1. **Check if update was published:**
   ```bash
   eas update:list --channel production
   ```

2. **Verify app is production build:**
   - Updates only work in production builds (not `expo start` development mode)
   - Must be installed via APK from EAS Build

3. **Check runtime version matches:**
   ```bash
   # In app.json, check runtimeVersion matches your build
   # Updates only apply to builds with matching runtimeVersion
   ```

4. **Check internet connection:**
   - App needs internet to check for updates
   - Will use cached version if offline

5. **Check app logs:**
   ```bash
   # Android
   adb logcat | grep -i "expo\|update"
   
   # Look for errors like:
   # - "Updates not enabled"
   # - "Network error"
   # - "Invalid runtime version"
   ```

### Update Check Fails

**Common issues:**
- ❌ App is in development mode (`__DEV__ === true`)
- ❌ Runtime version mismatch
- ❌ No internet connection
- ❌ EAS project ID mismatch
- ❌ Update channel doesn't match build channel

**Solutions:**
```bash
# Check your build channel
eas build:list

# Check your update channel
eas update:list --channel production

# Make sure they match!
```

### App Crashes After Update

1. **Rollback immediately:**
   ```bash
   eas update:rollback --channel production
   ```

2. **Check update logs:**
   ```bash
   eas update:view [update-id]
   ```

3. **Rebuild APK if needed:**
   ```bash
   npm run build:production
   ```

## Testing Checklist

- [ ] Update published successfully
- [ ] Update appears in `eas update:list`
- [ ] App is production build (not dev)
- [ ] App is force-closed and reopened
- [ ] Console shows update check logs
- [ ] Update downloads successfully
- [ ] App reloads with new code
- [ ] Changes are visible in app
- [ ] No errors in console

## Best Practices

1. **Always test in preview channel first:**
   ```bash
   ./publish-update.sh preview "Test update"
   ```

2. **Use descriptive messages:**
   ```bash
   ./publish-update.sh production "Fixed red screen overlay - v1.0.4"
   ```

3. **Monitor update status:**
   ```bash
   eas update:list --channel production
   ```

4. **Have a rollback plan:**
   ```bash
   eas update:rollback --channel production
   ```

## Debug Commands

```bash
# List all updates
eas update:list --channel production

# View specific update
eas update:view [update-id]

# Check build info
eas build:list

# View app logs (Android)
adb logcat | grep -i expo

# Check runtime version in app.json
cat app.json | grep runtimeVersion
```

