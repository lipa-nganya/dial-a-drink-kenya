#!/bin/bash
# Deploy Admin Frontend to Google Cloud Run

set -e

echo "🚀 Deploying Admin Frontend to Google Cloud Run..."
echo ""

cd "$(dirname "$0")/admin-frontend"

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build React app
echo "📦 Building React app..."
npm install
npm run build

# Deploy to Cloud Run
# Use --update-env-vars to preserve existing environment variables
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy deliveryos-admin \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api"

echo ""
echo "✅ Admin Frontend deployed successfully!"
echo "📋 Service URL:"
gcloud run services describe deliveryos-admin --format="value(status.url)"


