#!/bin/bash

# Script to update app icon from Downloads folder
# Usage: ./update-icon.sh or bash update-icon.sh

set -e  # Exit on error

echo "📱 Updating app icon..."

DOWNLOAD_ICON="$HOME/Downloads/driver_icon.png"
TARGET_ICON="/Users/maria/dial-a-drink/DDDriverExpo/assets/icon.png"
ADAPTIVE_ICON="/Users/maria/dial-a-drink/DDDriverExpo/assets/adaptive-icon.png"

# Check if source file exists
if [ ! -f "$DOWNLOAD_ICON" ]; then
  echo "❌ Error: $DOWNLOAD_ICON not found"
  echo "Please make sure driver_icon.png is in your Downloads folder"
  exit 1
fi

echo "✅ Found icon: $DOWNLOAD_ICON"

# Copy to main icon
echo "📋 Copying to app icon..."
cp "$DOWNLOAD_ICON" "$TARGET_ICON"
if [ $? -eq 0 ]; then
  echo "✅ Main icon updated: $TARGET_ICON"
else
  echo "❌ Failed to copy main icon"
  exit 1
fi

# Copy to adaptive icon (Android)
echo "📋 Copying to adaptive icon..."
cp "$DOWNLOAD_ICON" "$ADAPTIVE_ICON"
if [ $? -eq 0 ]; then
  echo "✅ Adaptive icon updated: $ADAPTIVE_ICON"
else
  echo "❌ Failed to copy adaptive icon"
  exit 1
fi

echo ""
echo "✅ App icon updated successfully!"
echo ""
echo "📝 Note: For the icon to appear in the app drawer:"
echo "   1. The icon should be 1024x1024 pixels (PNG format)"
echo "   2. You may need to rebuild the app for the icon to take effect"
echo "   3. Run: cd DDDriverExpo && eas build --platform android --profile production"
echo ""

