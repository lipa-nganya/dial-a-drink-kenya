# Production Build Script

## Quick Build

Run the build script to automatically:
1. Install dependencies
2. Auto-increment version
3. Commit and push changes
4. Build production APK

```bash
cd DDDriverExpo
./build-and-push.sh
```

## Custom Version

To specify a custom version:

```bash
./build-and-push.sh 1.0.13
```

## What the Script Does

1. **Installs dependencies** - Runs `npm install` to ensure all packages are installed
2. **Updates version** - Auto-increments the patch version (or uses your specified version)
3. **Commits changes** - Commits all changes with a version bump message
4. **Pushes to GitHub** - Pushes all commits to the remote repository
5. **Builds APK** - Starts an EAS production build for Android

## Build Status

Check build status:
```bash
eas build:list --platform android --limit 1
```

View builds online:
https://expo.dev/accounts/[your-account]/projects/dddriver/builds

## Build Time

- Typically takes **10-20 minutes**
- You'll receive an **email notification** when complete
- Download link will be provided in the email and terminal

## Download APK

Once the build completes:
1. Check your email for the download link
2. Or run: `eas build:list --platform android --limit 1`
3. Download the APK and distribute to drivers

