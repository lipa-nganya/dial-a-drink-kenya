#!/bin/bash

# Script to prepare and build a new production APK
# Usage: ./build-and-push.sh [version]
# Example: ./build-and-push.sh 1.0.13

set -e

VERSION=${1:-"auto"}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting production build process..."
echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Driver app: $SCRIPT_DIR"

# Step 1: Install dependencies
echo ""
echo "📦 Step 1: Installing dependencies..."
cd "$SCRIPT_DIR"
npm install

# Step 2: Update version if auto
if [ "$VERSION" = "auto" ]; then
  echo ""
  echo "📝 Step 2: Auto-incrementing version..."
  CURRENT_VERSION=$(grep -o '"version": "[^"]*"' app.json | cut -d'"' -f4)
  echo "Current version: $CURRENT_VERSION"
  
  # Extract major, minor, patch
  MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
  MINOR=$(echo $CURRENT_VERSION | cut -d. -f2)
  PATCH=$(echo $CURRENT_VERSION | cut -d. -f3)
  
  # Increment patch
  PATCH=$((PATCH + 1))
  NEW_VERSION="$MAJOR.$MINOR.$PATCH"
else
  NEW_VERSION="$VERSION"
fi

echo "New version: $NEW_VERSION"

# Update app.json version
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" app.json
else
  # Linux
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" app.json
fi

# Step 3: Commit and push changes
echo ""
echo "📝 Step 3: Committing and pushing changes..."
cd "$PROJECT_ROOT"
git add -A
git commit -m "Bump version to $NEW_VERSION and prepare for production build" || echo "No changes to commit"
git push

# Step 4: Build production APK
echo ""
echo "🏗️  Step 4: Building production APK..."
echo "This will take 10-20 minutes. You'll receive an email when complete."
cd "$SCRIPT_DIR"
eas build --platform android --profile production

echo ""
echo "✅ Build process started!"
echo "📱 Check build status: cd DDDriverExpo && eas build:list --platform android --limit 1"
echo "🌐 Or visit: https://expo.dev/accounts/[your-account]/projects/dddriver/builds"
echo ""
echo "📦 Version: $NEW_VERSION"
echo "⏱️  Build typically takes 10-20 minutes"

