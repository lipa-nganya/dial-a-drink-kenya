#!/bin/bash
# Deploy Customer Frontend to Google Cloud Run

set -e

echo "🚀 Deploying Customer Frontend to Google Cloud Run..."
echo ""

cd "$(dirname "$0")/frontend"

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build React app
echo "📦 Building React app..."
npm install
npm run build

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy deliveryos-customer \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api" \
  --memory 256Mi

echo ""
echo "✅ Frontend deployed successfully!"
echo "📋 Service URL:"
gcloud run services describe deliveryos-customer --format="value(status.url)"


