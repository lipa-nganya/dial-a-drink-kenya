#!/bin/bash

# Download Latest APK Script

echo "📥 Downloading latest APK..."
echo ""

if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Install with: npm install -g eas-cli"
    exit 1
fi

# Check login
if ! eas whoami &> /dev/null; then
    echo "❌ Not logged in. Please run: eas login"
    exit 1
fi

# Download latest build
eas build:download --platform android

echo ""
echo "✅ APK downloaded! Check the builds/ directory"
echo "📱 Transfer to your phone and install!"

























