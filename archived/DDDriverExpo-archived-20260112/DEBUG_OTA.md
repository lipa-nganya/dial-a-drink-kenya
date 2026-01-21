# Debug OTA Updates Not Working

## Quick Checks

### 1. Are you in Development Mode?
OTA updates **ONLY work in production builds**, not when running `expo start` or `npm start`.

**Check:**
- If you see `🔧 Development mode - skipping update check` in logs, OTA won't work
- Development builds disable OTA updates for security

**Solution:**
You need to build and install a production APK:
```bash
cd DDDriverExpo
npm run build:production
# Install the APK on your device
```

### 2. Was the Update Published?
Check if your update was actually published:
```bash
cd DDDriverExpo
eas update:list --channel production
```

You should see your update in the list with:
- Update ID
- Message
- Created date
- Runtime version

### 3. Check Console Logs
When you open the app, check the logs for:
```bash
# Android
adb logcat | grep -i "update\|ota\|expo"
```

Look for:
- `🔍 OTA Update Check Started`
- `🔄 Checking for OTA updates...`
- `✅ Update available!` or `✅ App is up to date`
- Any error messages

### 4. Runtime Version Mismatch
OTA updates only apply to apps with matching runtime versions.

**Check app.json:**
```json
"runtimeVersion": {
  "policy": "appVersion"
}
```

This means runtime version = `1.0.10` (from `version` field).

**Check your build:**
- The APK you installed must have version `1.0.10`
- The update must be published for runtime version `1.0.10`

**Verify:**
```bash
# Check update runtime version
eas update:list --channel production

# Check your app version
# In app.json, look at "version": "1.0.10"
```

### 5. Manual Update Check
I've added a "🔄 Check Update" button on the HomeScreen (only visible in production builds).

Use it to manually trigger an update check and see what happens.

## Common Issues

### Issue 1: "Updates not enabled"
**Cause:** Running in development mode or using development build

**Fix:**
1. Build production APK: `npm run build:production`
2. Install APK on device
3. Publish update: `./publish-update.sh production "Your update"`
4. Close and reopen app

### Issue 2: "No updates available" but changes not applied
**Possible causes:**
- Update wasn't published
- Runtime version mismatch
- Update published to wrong channel

**Fix:**
1. Verify update was published: `eas update:list --channel production`
2. Check runtime version matches
3. Ensure app and update are on same channel

### Issue 3: Update check fails silently
**Check logs for errors:**
- Network errors
- Authentication errors
- Invalid update URL

**Fix:**
- Check internet connection
- Verify EAS credentials: `eas whoami`
- Check app.json has correct `updates.url`

## Step-by-Step Debugging

### Step 1: Verify Build Type
```bash
# Check if you're in dev mode
# Look for __DEV__ === true in logs
```

### Step 2: Check Update Was Published
```bash
cd DDDriverExpo
eas update:list --channel production
```

### Step 3: Check App Version
```bash
# In app.json
cat app.json | grep version
# Should match runtime version in update
```

### Step 4: Check Logs
```bash
# Watch logs when opening app
adb logcat | grep -i "update\|ota"

# Look for:
# - Update check started
# - Update available/downloaded
# - Any errors
```

### Step 5: Manual Check
- Use "🔄 Check Update" button on HomeScreen
- See what message appears

### Step 6: Verify Update Applied
After update should be applied:
- Check console logs for "Update downloaded"
- App should reload automatically
- Changes should be visible

## Testing OTA Updates

### Proper Test Flow:
1. **Build production APK:**
   ```bash
   cd DDDriverExpo
   npm run build:production
   ```

2. **Install APK on device**

3. **Make code changes**

4. **Publish update:**
   ```bash
   ./publish-update.sh production "Test update"
   ```

5. **Verify update:**
   ```bash
   eas update:list --channel production
   ```

6. **Test on device:**
   - Force close app completely
   - Reopen app
   - Watch logs for update check
   - App should reload with new code

## If Still Not Working

1. **Check update was actually published:**
   ```bash
   eas update:list --channel production
   ```

2. **Verify app version matches:**
   - Check `app.json` version field
   - Check update runtime version matches

3. **Check network:**
   - App needs internet to check for updates
   - Will use cached version if offline

4. **Rebuild APK:**
   - Sometimes a fresh build is needed
   - Especially if runtime version changed

5. **Check EAS credentials:**
   ```bash
   eas whoami
   eas login
   ```

