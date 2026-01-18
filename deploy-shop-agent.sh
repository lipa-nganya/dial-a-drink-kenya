#!/bin/bash
# Deploy Shop Agent Frontend to Netlify

set -e

echo "🚀 Deploying Shop Agent Frontend to Netlify..."
echo ""

cd "$(dirname "$0")/shop-agent-frontend"

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
  echo "❌ Netlify CLI is not installed. Installing..."
  npm install -g netlify-cli
fi

# Build React app
echo "📦 Building React app..."
npm install
npm run build

# Deploy to Netlify
echo "🚀 Deploying to Netlify..."
netlify deploy --prod --dir=build

echo ""
echo "✅ Shop Agent Frontend deployed successfully to Netlify!"
