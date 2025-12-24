#!/bin/bash

# Simple APK Build Script (non-interactive)
# Quick build without prompts

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 Building DD Driver APK..."

# Check EAS CLI
if ! command -v eas &> /dev/null; then
    echo "Installing EAS CLI..."
    npm install -g eas-cli
fi

# Check login
if ! eas whoami &> /dev/null; then
    echo "Please login first: eas login"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build
echo "Starting build (this takes 10-20 minutes)..."
eas build --platform android --profile preview

echo ""
echo "✅ Build started! Check email or run: eas build:list"
echo "Download when ready: eas build:download"

























