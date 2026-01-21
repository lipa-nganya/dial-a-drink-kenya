#!/bin/bash

# Script to configure FCM credentials for Expo
# This script guides you through uploading FCM Server Key to Expo

set -e

cd "$(dirname "$0")"

echo "🔐 FCM Credentials Configuration for Expo"
echo "=========================================="
echo ""

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
  echo "❌ Not logged in to Expo"
  echo "Please run: eas login"
  exit 1
fi

echo "✅ Logged in to Expo"
echo ""

echo "📋 To configure FCM credentials, you need:"
echo ""
echo "1. FCM Server Key from Firebase Console"
echo "   - Go to: https://console.firebase.google.com/project/drink-suite/settings/cloudmessaging"
echo "   - Find 'Server key' under 'Cloud Messaging API (Legacy)'"
echo "   - Copy the key"
echo ""
echo "2. Then run this command:"
echo "   eas credentials"
echo ""
echo "3. Select:"
echo "   - Android"
echo "   - Push Notifications (FCM)"
echo "   - Set up new credentials (or Update existing)"
echo "   - Paste your FCM Server Key"
echo ""
echo "4. After uploading, rebuild the app:"
echo "   eas build --platform android --profile local-dev"
echo ""
echo "⚠️  Note: The FCM Server Key is different from the Firebase service account JSON"
echo "   - Service account JSON = for backend (already configured)"
echo "   - FCM Server Key = for app builds (needs to be uploaded to Expo)"
echo ""

read -p "Press Enter to open Firebase Console and get the FCM Server Key, then run 'eas credentials' manually..."


