#!/bin/bash
# Build Android Production APK/AAB
# This script builds the production version of the driver app

set -e

echo "📱 Building Android Production App"
echo "==================================="
echo ""

# Check if production config exists
if [ ! -f "production-config.env" ]; then
    echo "⚠️  Warning: production-config.env not found"
    echo "   Some production API URLs may not be configured"
    echo ""
fi

# Load production config if available
if [ -f "production-config.env" ]; then
    source production-config.env
    PRODUCTION_API_URL="${BACKEND_URL:-}"
    echo "📋 Production API URL: $PRODUCTION_API_URL"
    echo ""
fi

# Check if driver-app-native exists
if [ ! -d "driver-app-native" ]; then
    echo "❌ Error: driver-app-native directory not found"
    exit 1
fi

cd driver-app-native

echo "📦 Step 1: Updating production API URL..."
echo ""

# Update gradle.properties with production API URL if provided
if [ -n "$PRODUCTION_API_URL" ]; then
    if [ -f "gradle.properties" ]; then
        # Update or add PROD_API_BASE_URL
        if grep -q "PROD_API_BASE_URL" gradle.properties; then
            sed -i.bak "s|PROD_API_BASE_URL=.*|PROD_API_BASE_URL=$PRODUCTION_API_URL|" gradle.properties
        else
            echo "" >> gradle.properties
            echo "# Production API URL" >> gradle.properties
            echo "PROD_API_BASE_URL=$PRODUCTION_API_URL" >> gradle.properties
        fi
        echo "✅ Updated gradle.properties with production API URL"
    fi
fi

echo ""
echo "📦 Step 2: Building Production APK..."
echo ""

# Make gradlew executable
if [ -f "gradlew" ]; then
    chmod +x gradlew
    echo "✅ Gradle wrapper is executable"
else
    echo "❌ Error: gradlew not found"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean

# Build production release APK
echo ""
echo "🔨 Building production release APK..."
./gradlew assembleProductionRelease

# Check if build succeeded
if [ $? -eq 0 ]; then
    APK_PATH="app/build/outputs/apk/production/release/app-production-release.apk"
    if [ -f "$APK_PATH" ]; then
        APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
        echo ""
        echo "✅ Production APK built successfully!"
        echo ""
        echo "📦 APK Details:"
        echo "   Location: $APK_PATH"
        echo "   Size: $APK_SIZE"
        echo ""
        
        # Also build AAB for Play Store
        echo "📦 Step 3: Building Production AAB (for Play Store)..."
        ./gradlew bundleProductionRelease
        
        if [ $? -eq 0 ]; then
            AAB_PATH="app/build/outputs/bundle/productionRelease/app-production-release.aab"
            if [ -f "$AAB_PATH" ]; then
                AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
                echo ""
                echo "✅ Production AAB built successfully!"
                echo ""
                echo "📦 AAB Details:"
                echo "   Location: $AAB_PATH"
                echo "   Size: $AAB_SIZE"
                echo ""
            fi
        fi
        
        echo "═══════════════════════════════════════════════════════"
        echo "✅ Production Build Complete!"
        echo "═══════════════════════════════════════════════════════"
        echo ""
        echo "📱 APK (for direct installation):"
        echo "   $APK_PATH"
        echo ""
        if [ -f "$AAB_PATH" ]; then
            echo "📦 AAB (for Google Play Store):"
            echo "   $AAB_PATH"
            echo ""
        fi
        echo "📝 Next Steps:"
        echo "   1. Test the APK on a device"
        echo "   2. Sign the APK if needed (for distribution)"
        echo "   3. Upload AAB to Google Play Console"
        echo "   4. Configure app signing in Play Console"
        echo ""
    else
        echo "❌ Error: APK file not found at expected location"
        exit 1
    fi
else
    echo "❌ Error: Build failed"
    exit 1
fi
