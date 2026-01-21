#!/bin/bash
echo "🧹 Cleaning Expo build cache..."
cd "$(dirname "$0")"

# Stop any running Metro bundler
pkill -f "expo start" || true
pkill -f "metro" || true

# Remove Expo cache
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .expo-shared

# For Android specifically
rm -rf android/app/build
rm -rf android/.gradle

echo "✅ Cache cleared!"
echo ""
echo "Next steps:"
echo "1. npx expo start -c"
echo "2. Uninstall the app completely from your device"
echo "3. Reinstall the app"
