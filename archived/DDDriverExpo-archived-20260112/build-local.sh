#!/bin/bash
# Build script for local-dev APK
# Run this script: ./build-local.sh

cd "$(dirname "$0")"

# Build limit removed - builds are now unlimited

echo "🚀 Building Local Dev APK..."
echo ""
echo "This will create an APK that connects to your local backend."
echo ""

# Set environment variables for local build
export EXPO_PUBLIC_ENV=local
export EXPO_PUBLIC_BUILD_PROFILE=local-dev

# Run the build
eas build --platform android --profile local-dev

echo ""
echo "✅ Build started! Check your email or run 'eas build:list' to see status."
echo "📥 Download when ready: eas build:download"

