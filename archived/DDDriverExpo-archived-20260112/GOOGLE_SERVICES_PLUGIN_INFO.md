# Google Services Gradle Plugin in Expo

## How Expo Handles It

In **Expo managed apps**, you **DO NOT** need to manually configure the Google Services Gradle plugin.

When you specify `googleServicesFile` in `app.json`:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

Expo **automatically**:
1. ✅ Adds the Google Services Gradle plugin to the project
2. ✅ Applies it to the app module
3. ✅ Processes `google-services.json` during the build
4. ✅ Makes Firebase configuration values accessible to Firebase SDKs

## Verification

### 1. Check app.json
```json
"android": {
  "googleServicesFile": "./google-services.json"
}
```

### 2. Verify google-services.json exists
```bash
cd DDDriverExpo
ls -la google-services.json
```

### 3. Verify file is valid JSON
```bash
cat google-services.json | python3 -m json.tool
```

### 4. Check package name matches
The `package_name` in `google-services.json` must match:
- `app.json`: `"package": "com.dialadrink.driver"`

## If You're Seeing Errors

### Error: "Google Services plugin not found"
- **Solution**: This shouldn't happen in Expo managed apps
- **Check**: Ensure you're using `eas build`, not a bare workflow
- **Verify**: `app.json` has `googleServicesFile` specified

### Error: "google-services.json not found"
- **Solution**: Ensure file is in project root (`DDDriverExpo/google-services.json`)
- **Check**: File is committed to git (or use `eas credentials`)

### Error: "Package name mismatch"
- **Solution**: Ensure `package_name` in `google-services.json` matches `app.json`
- **Check**: Both should be `com.dialadrink.driver`

## Manual Configuration (Bare Workflow Only)

If you're using a **bare workflow** (not managed Expo), you would need to:

### Project-level build.gradle.kts
```kotlin
plugins {
    id("com.android.application") version "7.3.0" apply false
    id("com.google.gms.google-services") version "4.4.4" apply false
}
```

### App-level build.gradle.kts
```kotlin
plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}
```

**But since you're using Expo managed workflow, this is NOT needed!**

## Current Setup

✅ `app.json` has `googleServicesFile` configured
✅ `google-services.json` is in project root
✅ Package name matches: `com.dialadrink.driver`

The Google Services plugin will be automatically applied during `eas build`.

## Testing

After building with `eas build`, the plugin should:
1. Process `google-services.json`
2. Generate Firebase configuration
3. Make it available to Firebase SDKs
4. Allow `getDevicePushTokenAsync()` to work

If `getDevicePushTokenAsync()` still fails after build, check:
- Build logs for Google Services plugin errors
- Firebase project configuration
- Package name in Firebase Console matches app


