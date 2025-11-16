#!/bin/bash

# Script to publish OTA updates for the driver app
# Usage: ./publish-update.sh <channel> <message>
# Example: ./publish-update.sh production "Fixed bug in order screen"
#
# IMPORTANT: This script sets environment variables based on the channel:
# - local-dev: Uses ngrok/localhost API URL
# - production/development/cloud-dev: Uses cloud-dev API URL

set -e

CHANNEL=$1
MESSAGE=$2

if [ -z "$CHANNEL" ] || [ -z "$MESSAGE" ]; then
  echo "❌ Error: Channel and message are required"
  echo "Usage: ./publish-update.sh <channel> <message>"
  echo "Example: ./publish-update.sh production \"Fixed bug\""
  echo ""
  echo "Available channels:"
  echo "  - local-dev: Uses localhost/ngrok API URL"
  echo "  - production: Uses cloud-dev API URL"
  echo "  - development: Uses cloud-dev API URL"
  echo "  - cloud-dev: Uses cloud-dev API URL"
  echo "  - preview: Uses cloud-dev API URL"
  exit 1
fi

echo "🚀 Publishing OTA update to channel: $CHANNEL"
echo "📝 Message: $MESSAGE"
echo ""

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

# Set environment variables based on channel
# CRITICAL: These environment variables are embedded in the OTA update
# and will be used by the app when it loads the update
if [ "$CHANNEL" == "local-dev" ]; then
  export EXPO_PUBLIC_ENV="local"
  export EXPO_PUBLIC_BUILD_PROFILE="local-dev"
  export EXPO_PUBLIC_API_BASE_URL="https://homiest-psychopharmacologic-anaya.ngrok-free.dev"
  echo "🔧 Environment: LOCAL DEV"
  echo "   API URL: $EXPO_PUBLIC_API_BASE_URL"
elif [ "$CHANNEL" == "production" ] || [ "$CHANNEL" == "development" ] || [ "$CHANNEL" == "cloud-dev" ] || [ "$CHANNEL" == "preview" ]; then
  export EXPO_PUBLIC_ENV="cloud"
  export EXPO_PUBLIC_BUILD_PROFILE="$CHANNEL"
  export EXPO_PUBLIC_API_BASE_URL="https://dialadrink-backend-910510650031.us-central1.run.app"
  echo "🔧 Environment: CLOUD DEV"
  echo "   API URL: $EXPO_PUBLIC_API_BASE_URL"
else
  echo "⚠️  Warning: Unknown channel '$CHANNEL', using cloud-dev defaults"
  export EXPO_PUBLIC_ENV="cloud"
  export EXPO_PUBLIC_API_BASE_URL="https://dialadrink-backend-910510650031.us-central1.run.app"
fi

echo ""
echo "📤 Publishing update..."

eas update --channel "$CHANNEL" --message "$MESSAGE"

echo ""
echo "✅ Update published successfully!"
echo "📱 Apps on channel '$CHANNEL' will receive the update on next launch"
echo ""
echo "💡 Note: The API URL is determined by:"
echo "   1. Update channel (checked first) - $CHANNEL"
echo "   2. Environment variables (EXPO_PUBLIC_API_BASE_URL)"
echo "   3. Build profile (from bundle ID)"
echo ""
echo "   For this update, channel '$CHANNEL' will use: $EXPO_PUBLIC_API_BASE_URL"
