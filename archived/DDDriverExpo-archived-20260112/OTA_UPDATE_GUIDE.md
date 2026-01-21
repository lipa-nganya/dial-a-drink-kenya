# OTA (Over-The-Air) Updates Guide

## Overview

OTA updates allow you to push code changes to the driver app without rebuilding and reinstalling the APK. This is perfect for:
- Bug fixes
- UI improvements
- Feature additions (that don't require native code changes)
- Quick hotfixes

## What's Included

### ✅ Automatic Update Checking
- App checks for updates on every launch
- Updates download automatically in the background
- App reloads to apply updates

### ✅ Update Channels
- **development**: For testing
- **preview**: For internal testing
- **production**: For live app

### ✅ Easy Publishing Script
- Simple script to publish updates: `./publish-update.sh`

## Setup

### 1. Install Dependencies
```bash
cd DDDriverExpo
npm install
```

This will install `expo-updates` automatically.

### 2. Install EAS CLI (if not already installed)
```bash
npm install -g eas-cli
```

### 3. Login to Expo
```bash
eas login
```

## Publishing Updates

### Quick Method (Using Script)
```bash
# Make script executable (first time only)
chmod +x publish-update.sh

# Publish to preview channel
./publish-update.sh preview "Fixed red screen overlay"

# Publish to production channel
./publish-update.sh production "Added new features"
```

### Manual Method
```bash
# Preview channel
eas update --channel preview --message "Your update message"

# Production channel
eas update --channel production --message "Your update message"
```

## Building New APKs

When you need to rebuild the APK (for native code changes, new permissions, etc.):

```bash
# Preview build
npm run build:preview

# Production build
npm run build:production
```

Or use EAS directly:
```bash
eas build --platform android --profile preview
eas build --platform android --profile production
```

## How It Works

1. **Development**: Changes are instant (hot reload)
2. **Production Build**: First install requires APK
3. **OTA Updates**: After first install, updates come via OTA

### Update Flow:
1. Developer makes code changes
2. Runs `./publish-update.sh production "Update message"`
3. Update is published to Expo's CDN
4. Driver app checks for updates on next launch
5. Update downloads automatically
6. App reloads with new code

## Limitations

⚠️ **OTA updates CANNOT change:**
- Native dependencies (expo-av, expo-status-bar, etc.)
- App permissions
- app.json configuration (version, permissions, etc.)
- Native code changes
- New native modules

✅ **OTA updates CAN change:**
- JavaScript/TypeScript code
- React components
- UI/UX changes
- Business logic
- API endpoints
- Styling

## Update Channels

### Development Channel
- For internal testing
- Updates are instant
- Use during development

### Preview Channel
- For beta testing
- Test updates before production
- Can be shared with testers

### Production Channel
- For live app
- All drivers receive updates
- Most stable updates go here

## Checking Update Status

### View Update History
```bash
eas update:list --channel production
```

### View Update Details
```bash
eas update:view [update-id]
```

## Rollback Updates

If an update breaks something:

```bash
# Rollback to previous update
eas update:rollback --channel production
```

## Troubleshooting

### Updates Not Appearing
1. Check if update was published: `eas update:list --channel production`
2. Verify app is checking for updates (check console logs)
3. Ensure app version matches build channel
4. Check internet connection

### Update Check Fails
- Updates only work in production builds (not development)
- Check Expo project ID matches
- Verify EAS credentials

### App Crashes After Update
1. Rollback: `eas update:rollback --branch production`
2. Check update logs for errors
3. Rebuild APK if needed

## Best Practices

1. **Test First**: Always test updates in preview channel first
2. **Clear Messages**: Use descriptive update messages
3. **Version Bump**: Bump version in app.json for tracking
4. **Monitor**: Check update status after publishing
5. **Rollback Plan**: Know how to rollback if needed

## Example Workflow

```bash
# 1. Make code changes
# ... edit files ...

# 2. Test locally
npm start

# 3. Publish to preview for testing
./publish-update.sh preview "Testing new feature"

# 4. Test on device
# ... test on actual device ...

# 5. Publish to production
./publish-update.sh production "Released new feature"

# 6. Monitor update status
eas update:list --channel production
```

## Commands Reference

```bash
# Publish updates
./publish-update.sh [channel] "message"
eas update --channel [channel] --message "message"

# Build APKs
npm run build:preview
npm run build:production

# Check updates
eas update:list --branch production
eas update:view [update-id]

# Rollback
eas update:rollback --channel production
```

## Notes

- Updates are downloaded automatically on app launch
- Updates apply immediately (app reloads)
- No user action required
- Works offline (uses cached version if update check fails)
- Updates are incremental (only downloads changed files)

