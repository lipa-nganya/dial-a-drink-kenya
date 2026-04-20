#!/bin/bash
# Deploy Shop Agent Frontend to Google Cloud Run

set -e

echo "🚀 Deploying Shop Agent Frontend to Google Cloud Run..."
echo ""

cd "$(dirname "$0")/shop-agent-frontend"

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build and deploy to Cloud Run
echo "📦 Building and deploying to Cloud Run..."
gcloud run deploy deliveryos-shop-agent \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://deliveryos-backend-p6bkgryxqa-uc.a.run.app/api"

echo ""
echo "✅ Shop Agent Frontend deployed successfully to Cloud Run!"
echo "📋 Service URL:"
gcloud run services describe deliveryos-shop-agent --format="value(status.url)"
