#!/bin/bash

# Complete fix for package-lock.json sync issue
# This ensures all packages are properly resolved at root level

set -e

echo "🔧 Fixing package-lock.json sync issue..."

cd "$(dirname "$0")"

# Step 1: Remove everything
echo "🧹 Cleaning up..."
rm -rf node_modules package-lock.json

# Step 2: Ensure package.json has the dependencies
echo "📋 Verifying package.json..."
if ! grep -q "@expo/vector-icons" package.json; then
  npm install @expo/vector-icons@14.1.0 --save
fi
if ! grep -q "@react-navigation/bottom-tabs" package.json; then
  npm install @react-navigation/bottom-tabs@7.8.1 --save
fi
if ! grep -q "expo-font" package.json; then
  npm install expo-font@14.0.9 --save
fi

# Step 3: Install all dependencies fresh
echo "📦 Installing all dependencies..."
npm install --legacy-peer-deps

# Step 4: Verify packages are in lock file
echo "✅ Verifying packages in package-lock.json..."
if grep -q "node_modules/@expo/vector-icons" package-lock.json; then
  echo "✅ @expo/vector-icons found"
else
  echo "⚠️  @expo/vector-icons not found at root level"
fi

if grep -q "node_modules/@react-navigation/bottom-tabs" package-lock.json; then
  echo "✅ @react-navigation/bottom-tabs found"
else
  echo "⚠️  @react-navigation/bottom-tabs not found at root level"
fi

if grep -q '"node_modules/expo-font":' package-lock.json; then
  echo "✅ expo-font found"
else
  echo "⚠️  expo-font not found at root level"
fi

# Step 5: Test npm ci
echo ""
echo "🧪 Testing npm ci..."
if npm ci --dry-run 2>&1 | grep -q "Missing"; then
  echo "❌ npm ci still has issues"
  echo "Running npm install one more time..."
  npm install --legacy-peer-deps
else
  echo "✅ npm ci should work now!"
fi

echo ""
echo "✅ Fix complete! Commit and push the changes:"
echo "   git add package.json package-lock.json"
echo "   git commit -m 'Fix package-lock.json sync'"
echo "   git push"

