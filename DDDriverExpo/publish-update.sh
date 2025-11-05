#!/bin/bash

# Script to publish OTA updates for the driver app
# Usage: ./publish-update.sh [preview|production] "Update message"

set -e

CHANNEL=${1:-preview}
MESSAGE=${2:-"OTA Update"}

if [ "$CHANNEL" != "preview" ] && [ "$CHANNEL" != "production" ] && [ "$CHANNEL" != "development" ]; then
  echo "❌ Invalid channel. Use: preview, production, or development"
  exit 1
fi

echo "🚀 Publishing OTA update to $CHANNEL channel..."
echo "📝 Message: $MESSAGE"

cd "$(dirname "$0")"

# Check if eas-cli is installed
if ! command -v eas &> /dev/null; then
  echo "❌ eas-cli is not installed. Install it with: npm install -g eas-cli"
  exit 1
fi

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
  echo "🔐 Not logged in to Expo. Please run: eas login"
  exit 1
fi

# Publish the update
echo "📦 Publishing update..."
# Use --channel flag instead of --branch (EAS CLI uses channel)
eas update --channel "$CHANNEL" --message "$MESSAGE"

echo "✅ Update published successfully!"
echo ""
echo "📱 Drivers will receive this update automatically on next app launch"
echo "⏱️  Updates typically take effect within a few minutes"

