# Quick OTA Update Guide

## Quick Start

**⚠️ IMPORTANT**: Before publishing updates, make sure dependencies are installed:

```bash
cd DDDriverExpo

# Option 1: Clean install (recommended if you get "expo-updates not found" error)
rm -rf node_modules package-lock.json
npm install

# Option 2: Use Expo's install command (ensures compatibility)
npx expo install expo-updates

# Verify installation
ls node_modules/expo-updates || echo "❌ expo-updates not installed"
```

If you still get errors, try:
```bash
# Make sure expo is installed first
npm install expo@~54.0.22

# Use Expo's install command (auto-selects correct version)
npx expo install expo-updates

# Or install latest version
npm install expo-updates@latest
```

### Option 1: Using the Script (Recommended)
```bash
cd DDDriverExpo
chmod +x publish-update.sh  # Only needed once
./publish-update.sh production "Your update message"
```

### Option 2: Using Bash Directly
If the script has permission issues, run it with bash:
```bash
cd DDDriverExpo
bash publish-update.sh production "Your update message"
```

### Option 3: Using EAS CLI Directly
```bash
cd DDDriverExpo
eas update --channel production --message "Your update message"
```

## Common Commands

```bash
# Publish to production
eas update --channel production --message "Fixed red screen overlay"

# Publish to preview (for testing)
eas update --channel preview --message "Testing new feature"

# View update history
eas update:list --channel production

# Rollback if needed
eas update:rollback --channel production
```

## First Time Setup

1. **Install dependencies (REQUIRED - fixes "expo-updates not found" error):**
   ```bash
   cd DDDriverExpo
   npm install
   ```
   ⚠️ **Important**: If you get an error "expo-updates could not be found", run `npm install` first!

2. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

3. **Login to Expo:**
   ```bash
   eas login
   ```

4. **You're ready to publish updates!**

## Testing Updates

See [TEST_OTA_UPDATES.md](./TEST_OTA_UPDATES.md) for detailed testing instructions.

### Quick Test Steps

1. **Verify update was published:**
   ```bash
   eas update:list --channel production
   ```

2. **Test on driver app:**
   - Force close the driver app completely
   - Reopen the app
   - Watch for console logs:
     - `🔄 Checking for OTA updates...`
     - `✅ Update available! Downloading...`
     - `✅ Update downloaded! Reloading app...`
   - App will automatically reload with the new update

3. **Verify update applied:**
   - Check that your code changes are visible
   - Confirm console logs show update was downloaded

### Important Notes
- ⚠️ **Updates only work in production builds** (not development mode)
- Updates are checked automatically on app launch
- Updates download in background and apply immediately
- If update check fails, app continues with cached version

## Workflow

1. Make code changes
2. Test locally: `npm start`
3. Publish update: `eas update --channel production --message "Description"`
4. Verify update: `eas update:list --channel production`
5. Test on device: Close and reopen driver app
6. Drivers get update automatically on next app launch

