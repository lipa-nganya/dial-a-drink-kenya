# Sound File Update - Rebuild Required

## Why a Rebuild is Needed

The `driver_sound.wav` file is bundled using `require()` in the code:

```javascript
require('../../assets/driver_sound.wav')
```

**Assets bundled via `require()` are compiled into the native app binary at build time.** They cannot be updated via OTA (Over-The-Air) updates.

## What Needs to Happen

1. ✅ **Code changes can be pushed OTA** - The JavaScript code changes to `OrderAcceptanceScreen.js` can be updated via OTA
2. ❌ **Sound file needs a rebuild** - The `driver_sound.wav` asset needs to be included in a new build

## Options

### Option 1: Full Rebuild (Recommended)
Since the sound file is new, rebuild the app to include it:

```bash
cd DDDriverExpo
eas build --platform android --profile production
```

This will:
- Include the `driver_sound.wav` file in the APK
- Include all code changes
- Create a new version that drivers need to install

### Option 2: Use Remote URL (Future OTA Updates)
If you want to update the sound file via OTA in the future, you could:
- Host the sound file on a CDN/server
- Change the code to use `{ uri: 'https://...' }` instead of `require()`
- Then future sound updates can be pushed OTA without rebuilding

## Current Status

- ✅ Sound file is in `assets/driver_sound.wav`
- ✅ Code is updated to use the sound file
- ✅ Audio settings configured for silent/vibration mode
- ⏳ **Next step: Rebuild the app**

## Rebuild Command

```bash
cd /Users/maria/dial-a-drink/DDDriverExpo
eas build --platform android --profile production
```

After the build completes, drivers will need to install the new APK to get the sound file.

