#!/bin/bash

# Check Build Status Script

echo "📦 Checking build status..."
echo ""

if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Install with: npm install -g eas-cli"
    exit 1
fi

# List builds
eas build:list --platform android --limit 5

echo ""
echo "💡 To download latest build: eas build:download"
echo "💡 To view specific build: eas build:view [BUILD_ID]"

























