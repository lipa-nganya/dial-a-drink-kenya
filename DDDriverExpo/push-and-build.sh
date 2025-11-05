#!/bin/bash

# Script to push changes and build the app
# Usage: ./push-and-build.sh

set -e

echo "🚀 Starting push and build process..."

cd "$(dirname "$0")/.."

# Step 1: Check git status
echo ""
echo "📋 Checking git status..."
git status --short

# Step 2: Add and commit if needed
if [ -n "$(git status --porcelain DDDriverExpo/package.json DDDriverExpo/package-lock.json)" ]; then
  echo ""
  echo "📦 Staging package files..."
  git add DDDriverExpo/package.json DDDriverExpo/package-lock.json
  echo "💾 Committing changes..."
  git commit -m "Fix package-lock.json sync - add missing dependencies" || echo "No changes to commit"
fi

# Step 3: Push to remote
echo ""
echo "📤 Pushing to remote..."
git push origin || {
  echo "❌ Git push failed. Please check your git remote and credentials."
  exit 1
}
echo "✅ Git push completed"

# Step 4: Build with EAS
echo ""
echo "🔨 Starting EAS build..."
cd DDDriverExpo

# Check if logged in
if ! eas whoami &> /dev/null; then
  echo "⚠️  Not logged in to Expo. Please run: eas login"
  exit 1
fi

echo "✅ Logged in to Expo"
echo "🚀 Starting production build for Android..."
eas build --platform android --profile production

echo ""
echo "✅ Build started! Check the EAS dashboard for progress."
echo "📱 Monitor build: https://expo.dev/accounts/[your-account]/projects/d016afe9-031a-42ca-b832-94c00c800600/builds"

