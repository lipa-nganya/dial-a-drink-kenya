#!/bin/bash

# Script to build the driver app with new sound and icon
# Usage: ./build-app.sh

set -e

cd "$(dirname "$0")"

echo "🔨 Building Driver App"
echo "======================"
echo ""

# Check if logged in to Expo
echo "🔐 Checking Expo login status..."
if ! eas whoami &> /dev/null; then
  echo "❌ Not logged in to Expo"
  echo "Please run: eas login"
  exit 1
fi

echo "✅ Logged in to Expo"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
  echo "❌ EAS CLI not found. Install with: npm install -g eas-cli"
  exit 1
fi

echo "📦 Building Android APK..."
echo "This will include:"
echo "  ✅ New app icon"
echo "  ✅ Driver sound file (driver_sound.wav)"
echo "  ✅ Updated OrderAcceptanceScreen with sound playback"
echo ""
echo "Building may take 10-20 minutes..."
echo ""

# Build the app
eas build --platform android --profile production --non-interactive

echo ""
echo "✅ Build started!"
echo ""
echo "📱 Monitor build progress:"
echo "   https://expo.dev/accounts/[your-account]/projects/d016afe9-031a-42ca-b832-94c00c800600/builds"
echo ""
echo "💡 After build completes:"
echo "   1. Download the APK from the EAS dashboard"
echo "   2. Install on driver devices"
echo "   3. The new icon and sound will be available"

