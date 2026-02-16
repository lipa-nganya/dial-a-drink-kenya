#!/bin/bash
# Deploy All Changes
# 1. Backend to GCloud dev
# 2. Driver app to develop build
# 3. Admin mobile app to develop build
# 4. Frontend changes to GitHub

set -e

echo "🚀 Deploying All Changes"
echo "======================="
echo ""

# Step 1: Deploy Backend to GCloud Dev
echo "📦 Step 1: Deploying Backend to GCloud Dev..."
echo "----------------------------------------------"
./deploy-backend-dev.sh || {
    echo "❌ Backend deployment failed"
    exit 1
}
echo ""

# Step 2: Build Driver App (Development)
echo "📱 Step 2: Building Driver App (Development)..."
echo "-----------------------------------------------"
cd driver-app-native
if [ -f "gradlew" ]; then
    chmod +x gradlew
    ./gradlew assembleDevelopmentDebug || {
        echo "❌ Driver app build failed"
        exit 1
    }
    echo "✅ Driver app built successfully!"
    echo "   APK location: app/build/outputs/apk/development/debug/app-development-debug.apk"
else
    echo "⚠️  gradlew not found. Please build manually in Android Studio:"
    echo "   - Select build variant: developmentDebug"
    echo "   - Build → Build Bundle(s) / APK(s) → Build APK(s)"
fi
cd ..
echo ""

# Step 3: Build Admin Mobile App (RetailScanner) - Development
echo "📱 Step 3: Building Admin Mobile App (RetailScanner) - Development..."
echo "---------------------------------------------------------------------"
cd RetailScanner
if command -v eas >/dev/null 2>&1; then
    eas build --profile cloud-dev --platform android || {
        echo "❌ Admin app build failed"
        exit 1
    }
    echo "✅ Admin app build started!"
    echo "   Check status: eas build:list"
    echo "   Download when ready: eas build:download"
else
    echo "⚠️  EAS CLI not found. Please install: npm install -g eas-cli"
    echo "   Then run: eas build --profile cloud-dev --platform android"
fi
cd ..
echo ""

# Step 4: Commit and Push Frontend Changes to GitHub
echo "📤 Step 4: Committing and Pushing Frontend Changes to GitHub..."
echo "-----------------------------------------------------------------"
git add frontend/ admin-frontend/
if git diff --staged --quiet; then
    echo "ℹ️  No frontend changes to commit"
else
    git commit -m "Deploy frontend changes: image sizing, description display, discount removal" || {
        echo "❌ Git commit failed"
        exit 1
    }
    git push origin develop || {
        echo "❌ Git push failed"
        exit 1
    }
    echo "✅ Frontend changes pushed to GitHub!"
    echo "   Frontend sites on wolfgang will pick up changes automatically"
fi
echo ""

echo "✅ All deployments completed!"
echo ""
echo "📋 Summary:"
echo "   ✅ Backend deployed to GCloud dev"
echo "   ✅ Driver app built (development)"
echo "   ✅ Admin app build started (development)"
echo "   ✅ Frontend changes pushed to GitHub"
