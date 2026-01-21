#!/bin/bash
# Rebuild local-dev APK with ngrok URL
# This fixes the "Failed to send OTP" error on physical devices

cd "$(dirname "$0")"

# Build limit removed - builds are now unlimited

echo "🔧 Rebuilding Local Dev APK with ngrok URL..."
echo ""

# Get current ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['tunnels'][0]['public_url'] if data.get('tunnels') else '')" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
  echo "❌ Ngrok is not running!"
  echo ""
  echo "Please start ngrok first:"
  echo "  ngrok http 5001"
  echo ""
  echo "Then run this script again."
  exit 1
fi

echo "✅ Found ngrok URL: $NGROK_URL"
echo ""

# Set environment variables for local build with ngrok
export EXPO_PUBLIC_ENV=local
export EXPO_PUBLIC_BUILD_PROFILE=local-dev
export EXPO_PUBLIC_API_BASE_URL=$NGROK_URL

echo "🚀 Starting build with API URL: $NGROK_URL"
echo ""

# Run the build
eas build --platform android --profile local-dev

echo ""
echo "✅ Build started! Check your email or run 'eas build:list' to see status."
echo "📥 Download when ready: eas build:download"
echo ""
echo "⚠️  Note: After installing the new APK, the app will connect to: $NGROK_URL"

