#!/bin/bash
# Script to rename the customer frontend service from dialadrink-customer to deliveryos-customer
# Note: Cloud Run doesn't support renaming services directly, so we deploy a new service

set -e

echo "🔄 Renaming Customer Frontend Service"
echo "   Old: dialadrink-customer"
echo "   New: deliveryos-customer"
echo ""

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

cd "$(dirname "$0")/frontend"

# Build React app
echo "📦 Building React app..."
npm install
npm run build

# Deploy new service with new name
echo "🚀 Deploying new service: deliveryos-customer..."
gcloud run deploy deliveryos-customer \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api"

echo ""
echo "✅ New service deployed successfully!"
echo "📋 New Service URL:"
NEW_URL=$(gcloud run services describe deliveryos-customer --format="value(status.url)")
echo "   $NEW_URL"

echo ""
echo "⚠️  IMPORTANT: Next Steps"
echo "   1. Verify the new service works: $NEW_URL"
echo "   2. Update any external references (DNS, bookmarks, etc.)"
echo "   3. Once verified, you can optionally delete the old service:"
echo "      gcloud run services delete dialadrink-customer --region us-central1"
echo ""
echo "   Note: The old service will continue to work until deleted."
echo "   Both services can coexist during the transition period."

