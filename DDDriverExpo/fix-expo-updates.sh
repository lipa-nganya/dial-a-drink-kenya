#!/bin/bash

set -e

echo "=========================================="
echo "🔧 Installing expo-updates for OTA Updates"
echo "=========================================="
echo ""

cd "$(dirname "$0")"

echo "Step 1: Installing Expo SDK..."
npm install expo@~54.0.22

echo ""
echo "Step 2: Installing expo-updates (using Expo CLI for correct version)..."
npx expo install expo-updates

echo ""
echo "Step 3: Verifying installation..."
if [ -d "node_modules/expo-updates" ]; then
  VERSION=$(cat node_modules/expo-updates/package.json | grep '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
  echo "✅ SUCCESS: expo-updates is installed!"
  echo "   Version: $VERSION"
  echo ""
  echo "🚀 You can now publish OTA updates with:"
  echo "   ./publish-update.sh production 'Your message'"
else
  echo "❌ FAILED: expo-updates is not installed"
  echo ""
  echo "Trying alternative installation method..."
  npm install expo-updates@latest
  
  if [ -d "node_modules/expo-updates" ]; then
    echo "✅ SUCCESS: expo-updates installed with latest version"
  else
    echo "❌ Still failed. Please run manually:"
    echo "   npm install expo-updates@latest"
  fi
fi

echo ""
echo "=========================================="

