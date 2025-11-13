#!/bin/bash
# Deploy Driver App (Build APK via EAS)

set -e

echo "🚀 Building Driver App APK for Cloud..."
echo ""

cd "$(dirname "$0")/DDDriverExpo"

# Check build limit
source ./build-limiter.sh
if [ $? -ne 0 ]; then
    echo ""
    echo "💡 To override limit: ./manage-build-limit.sh reset"
    exit 1
fi

# Build cloud-dev APK
echo "📦 Building cloud-dev APK..."
eas build --platform android --profile cloud-dev

echo ""
echo "✅ Build started! Check status with: eas build:list"
echo "📥 Download when ready: eas build:download"

