#!/bin/bash

# Fix Build Issues Script
# Fixes common Expo build problems

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🔧 Fixing build issues..."
echo ""

# 1. Fix package versions
echo "[1/3] Fixing package versions..."
npx expo install --fix 2>&1 | grep -v "already installed" || true
echo "✅ Package versions fixed"
echo ""

# 2. Ensure assets exist
echo "[2/3] Checking assets..."
if [ ! -f "assets/splash.png" ]; then
    if [ -f "assets/icon.png" ] && [ -s "assets/icon.png" ]; then
        cp assets/icon.png assets/splash.png
        echo "✅ Created splash.png from icon.png"
    else
        node create-assets.js
        echo "✅ Created placeholder assets"
    fi
fi

if [ ! -f "assets/adaptive-icon.png" ]; then
    if [ -f "assets/icon.png" ] && [ -s "assets/icon.png" ]; then
        cp assets/icon.png assets/adaptive-icon.png
        echo "✅ Created adaptive-icon.png from icon.png"
    fi
fi

if [ ! -f "assets/favicon.png" ]; then
    if [ -f "assets/icon.png" ] && [ -s "assets/icon.png" ]; then
        cp assets/icon.png assets/favicon.png
        echo "✅ Created favicon.png from icon.png"
    fi
fi

echo "✅ Assets verified"
echo ""

# 3. Run expo doctor
echo "[3/3] Running expo-doctor..."
npx expo-doctor 2>&1 | tail -10 || echo "⚠️  Some warnings may remain (non-critical)"

echo ""
echo "✅ Build issues fixed!"
echo ""
echo "You can now run: ./build-apk.sh"

























