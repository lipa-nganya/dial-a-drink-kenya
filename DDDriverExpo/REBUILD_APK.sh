#!/bin/bash

# Rebuild APK Script - Checks for latest build first
# This helps avoid unnecessary rebuilds

echo "📱 DD Driver APK Rebuild Script"
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI not found. Install with: npm install -g eas-cli"
    exit 1
fi

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo "❌ Not logged in to EAS. Please run: eas login"
    exit 1
fi

echo "🔍 Checking for latest build..."
echo ""

# Get the latest build info
echo "📦 Latest build info:"
BUILD_OUTPUT=$(eas build:list --platform android --limit 1 --non-interactive 2>&1)
echo "$BUILD_OUTPUT"
echo ""

# Check if there are any builds
if echo "$BUILD_OUTPUT" | grep -qi "No builds found\|no builds" || [ -z "$BUILD_OUTPUT" ]; then
    echo "⚠️  No previous builds found"
    echo ""
    read -p "Start new build? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Build cancelled"
        exit 0
    fi
else
    # Try to get build status from JSON output (more reliable)
    BUILD_JSON=$(eas build:list --platform android --limit 1 --json --non-interactive 2>/dev/null)
    
    # Extract status using grep (works even if jq is not available)
    BUILD_STATUS=""
    if echo "$BUILD_JSON" | grep -q '"status"'; then
        BUILD_STATUS=$(echo "$BUILD_JSON" | grep -o '"status":"[^"]*"' | head -1 | sed 's/"status":"\(.*\)"/\1/')
    fi
    
    # Fallback: check output text if JSON parsing failed
    if [ -z "$BUILD_STATUS" ]; then
        if echo "$BUILD_OUTPUT" | grep -qi "finished\|completed"; then
            BUILD_STATUS="finished"
        elif echo "$BUILD_OUTPUT" | grep -qi "in progress\|in-progress"; then
            BUILD_STATUS="in-progress"
        elif echo "$BUILD_OUTPUT" | grep -qi "error\|failed"; then
            BUILD_STATUS="errored"
        elif echo "$BUILD_OUTPUT" | grep -qi "cancel"; then
            BUILD_STATUS="canceled"
        fi
    fi
    
    if [ "$BUILD_STATUS" = "finished" ]; then
        echo "✅ Latest build is complete!"
        echo ""
        echo "Options:"
        echo "  1. Download latest build (recommended - saves time & cost)"
        echo "  2. Start new build anyway"
        echo ""
        read -p "Choose option (1/2): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[1]$ ]]; then
            echo "📥 Downloading latest build..."
            eas build:download --platform android
            echo ""
            echo "✅ APK downloaded! Check the builds/ directory"
            echo "📱 Transfer to your phone and install!"
            exit 0
        elif [[ ! $REPLY =~ ^[2]$ ]]; then
            echo "Invalid option. Exiting."
            exit 0
        fi
    elif [ "$BUILD_STATUS" = "in-progress" ] || [ "$BUILD_STATUS" = "in_progress" ]; then
        echo "⏳ Latest build is still in progress..."
        echo ""
        read -p "Start a new build anyway? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Build cancelled. Wait for current build to complete."
            echo "Check status with: eas build:list"
            exit 0
        fi
    elif [ "$BUILD_STATUS" = "errored" ] || [ "$BUILD_STATUS" = "canceled" ]; then
        echo "⚠️  Latest build failed or was cancelled"
        echo ""
        read -p "Start new build? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Build cancelled"
            exit 0
        fi
    else
        echo "⚠️  Latest build status: $BUILD_STATUS"
        echo ""
        read -p "Start new build? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Build cancelled"
            exit 0
        fi
    fi
fi

# Increment version in app.json
echo ""
echo "📝 Updating version in app.json..."
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' app.json | cut -d'"' -f4)
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"

# Update version in app.json (works with both macOS and Linux sed)
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" app.json
else
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" app.json
fi

echo "✅ Version updated from $CURRENT_VERSION to $NEW_VERSION"
echo ""

# Build APK
echo "🚀 Starting EAS build..."
echo "This will take 10-20 minutes"
echo ""
echo "💡 Tip: You'll receive an email when the build completes"
echo ""

read -p "Continue with build? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled"
    exit 0
fi

eas build --platform android --profile preview

BUILD_STATUS=$?

echo ""
if [ $BUILD_STATUS -eq 0 ]; then
    echo "✅ Build started successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. Wait for email notification (10-20 minutes)"
    echo "  2. Check build status: eas build:list"
    echo "  3. Download when ready: eas build:download"
    echo ""
else
    echo "❌ Build failed to start"
    echo "Check your connection and try again"
fi
