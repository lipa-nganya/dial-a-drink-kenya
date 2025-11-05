#!/bin/bash

# Script to fix package-lock.json sync issue
# This regenerates package-lock.json to match package.json

echo "🔧 Fixing package-lock.json sync issue..."

cd "$(dirname "$0")"

# Remove old lock file
echo "📋 Removing old package-lock.json..."
rm -f package-lock.json

# Install dependencies to regenerate lock file
echo "📦 Running npm install to regenerate package-lock.json..."
npm install

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ package-lock.json regenerated successfully!"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Commit the updated package-lock.json:"
  echo "      git add package-lock.json package.json"
  echo "      git commit -m 'Update package-lock.json for new dependencies'"
  echo ""
  echo "   2. Push to trigger a new build"
else
  echo ""
  echo "❌ Failed to regenerate package-lock.json"
  exit 1
fi

