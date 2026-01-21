#!/bin/bash

echo "🔧 Installing expo-updates..."
cd "$(dirname "$0")"

# First, ensure expo is installed
echo "📦 Ensuring expo is installed..."
npm install expo@~54.0.22

# Remove node_modules and package-lock.json for clean install
echo "🧹 Cleaning existing installation..."
rm -rf node_modules/expo-updates package-lock.json

# Use Expo's install command (automatically selects correct version for SDK 54)
echo "📦 Installing expo-updates with Expo CLI (auto-selects correct version)..."
npx expo install expo-updates

# Verify expo-updates is installed
if [ -d "node_modules/expo-updates" ]; then
  echo "✅ expo-updates installed successfully!"
  echo "📦 Version: $(cat node_modules/expo-updates/package.json | grep '"version"' | head -1)"
else
  echo "❌ expo-updates NOT found after installation"
  echo "🔧 Trying manual installation..."
  npm install expo-updates@latest
fi

# Final check
if [ -d "node_modules/expo-updates" ]; then
  echo ""
  echo "✅ SUCCESS: expo-updates is now installed!"
  echo "🚀 You can now run: ./publish-update.sh production 'Your message'"
else
  echo ""
  echo "❌ FAILED: expo-updates could not be installed"
  echo "💡 Try running manually: npm install expo-updates@~0.28.19"
fi

