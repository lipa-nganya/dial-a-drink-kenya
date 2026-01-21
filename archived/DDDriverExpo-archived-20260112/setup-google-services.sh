#!/bin/bash

# Script to verify google-services.json setup

set -e

cd "$(dirname "$0")"

echo "🔍 Checking google-services.json setup..."
echo ""

# Check if file exists
if [ -f "google-services.json" ]; then
  echo "✅ google-services.json found"
  echo ""
  
  # Check if it's valid JSON
  if command -v jq &> /dev/null; then
    echo "📋 File contents:"
    cat google-services.json | jq '.' | head -20
    echo ""
    
    # Extract package name
    PACKAGE_NAME=$(cat google-services.json | jq -r '.project_info.android_client_info[0].package_name // .client[0].client_info.android_client_info.package_name // "not found"')
    EXPECTED_PACKAGE="com.dialadrink.driver"
    
    echo "📱 Package name in google-services.json: $PACKAGE_NAME"
    echo "📱 Expected package name: $EXPECTED_PACKAGE"
    
    if [ "$PACKAGE_NAME" = "$EXPECTED_PACKAGE" ]; then
      echo "✅ Package name matches!"
    else
      echo "⚠️  Package name mismatch! Make sure the Android app in Firebase uses: $EXPECTED_PACKAGE"
    fi
  else
    echo "📋 File exists (install 'jq' to validate JSON structure)"
  fi
  
  echo ""
  echo "✅ Setup complete! You can now rebuild the app:"
  echo "   eas build --platform android --profile local-dev"
else
  echo "❌ google-services.json not found"
  echo ""
  echo "📥 To get the file:"
  echo "   1. Go to: https://console.firebase.google.com/project/drink-suite/settings/general"
  echo "   2. Scroll to 'Your apps' section"
  echo "   3. Find or create Android app with package: com.dialadrink.driver"
  echo "   4. Download google-services.json"
  echo "   5. Save it to: $(pwd)/google-services.json"
  echo ""
  echo "   Then run this script again to verify."
fi


