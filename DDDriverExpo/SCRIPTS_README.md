# Build Scripts Guide

I've created several scripts to automate the APK building process:

## Available Scripts

### 1. `build-apk.sh` (Recommended - Interactive)

**Full interactive build script with checks:**

```bash
./build-apk.sh
```

**What it does:**
- ✅ Checks if EAS CLI is installed (installs if missing)
- ✅ Checks if you're logged in (prompts login if needed)
- ✅ Verifies project configuration
- ✅ Checks dependencies (installs if missing)
- ✅ Starts the build with confirmation
- ✅ Provides helpful next steps

**Best for:** First-time builds or when you want guided setup

### 2. `build-apk-simple.sh` (Quick Build)

**Non-interactive quick build:**

```bash
./build-apk-simple.sh
```

**What it does:**
- Checks EAS CLI
- Checks login status
- Installs dependencies if needed
- Starts build immediately

**Best for:** When you've already set everything up and want a quick build

### 3. `check-build.sh` (Check Status)

**Check your build status:**

```bash
./check-build.sh
```

**What it does:**
- Lists recent builds
- Shows build status
- Provides download commands

**Best for:** Checking if your build is complete

### 4. `download-apk.sh` (Download APK)

**Download the latest APK:**

```bash
./download-apk.sh
```

**What it does:**
- Downloads the latest completed build
- Saves to `builds/` directory

**Best for:** After build completes, download the APK

## Quick Start

### First Time Build

```bash
cd /Users/maria/dial-a-drink/DDDriverExpo
./build-apk.sh
```

Follow the prompts. The script will guide you through everything!

### Subsequent Builds

```bash
./build-apk-simple.sh
```

### Check Build Status

```bash
./check-build.sh
```

### Download APK

```bash
./download-apk.sh
```

## Usage Examples

### Complete Workflow

```bash
# 1. Build APK
./build-apk.sh

# 2. Wait 10-20 minutes, then check status
./check-build.sh

# 3. When build is complete, download
./download-apk.sh

# 4. Install APK on phone
# (Transfer APK from builds/ directory to phone)
```

### Quick Build (Everything Already Set Up)

```bash
./build-apk-simple.sh
```

## Script Features

All scripts include:
- ✅ Error checking
- ✅ Helpful messages
- ✅ Automatic dependency installation
- ✅ Status updates

## Troubleshooting

### "Permission denied"
```bash
chmod +x build-apk.sh build-apk-simple.sh check-build.sh download-apk.sh
```

### "EAS CLI not found"
The script will try to install it automatically, or:
```bash
npm install -g eas-cli
```

### "Not logged in"
```bash
eas login
```

## Manual Commands (If Scripts Don't Work)

```bash
# Build
eas build --platform android --profile preview

# Check status
eas build:list

# Download
eas build:download
```

## Notes

- **Build time:** 10-20 minutes
- **Email notification:** You'll receive email when build completes
- **Free tier:** Expo allows free cloud builds
- **APK location:** Downloaded to `builds/` directory

## Quick Reference

```bash
# Build (interactive)
./build-apk.sh

# Build (quick)
./build-apk-simple.sh

# Check status
./check-build.sh

# Download APK
./download-apk.sh
```

Enjoy building! 🚀

























