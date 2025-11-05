# Fix package-lock.json Sync Issue

## Problem
The build is failing because `npm ci` can't find these packages in package-lock.json:
- `@expo/vector-icons@14.1.0`
- `expo-font@14.0.9`
- `@react-navigation/bottom-tabs@7.8.1`

## Solution

Run these commands in order:

```bash
cd /Users/maria/dial-a-drink/DDDriverExpo

# 1. Remove old lock file and node_modules
rm -rf node_modules package-lock.json

# 2. Clean npm cache (optional but recommended)
npm cache clean --force

# 3. Install all dependencies fresh
npm install

# 4. Verify packages are installed
npm list @expo/vector-icons @react-navigation/bottom-tabs expo-font

# 5. Test that npm ci would work
npm ci --dry-run

# 6. If dry-run passes, commit the files
git add package.json package-lock.json
git commit -m "Fix package-lock.json sync - add missing dependencies"
git push
```

## Alternative: Use Expo Install

If the above doesn't work, use Expo's install command which handles version compatibility:

```bash
cd /Users/maria/dial-a-drink/DDDriverExpo

# Remove lock file
rm -f package-lock.json

# Use Expo install to get compatible versions
npx expo install @expo/vector-icons @react-navigation/bottom-tabs expo-font

# This will install compatible versions and update package.json/package-lock.json
# Then commit and push
git add package.json package-lock.json
git commit -m "Fix package-lock.json sync - add missing dependencies"
git push
```

## Verification

After running the commands, verify:
1. `package.json` has all three dependencies listed
2. `package-lock.json` has `node_modules/@expo/vector-icons`, `node_modules/@react-navigation/bottom-tabs`, and `node_modules/expo-font` entries
3. `npm ci --dry-run` passes without errors

