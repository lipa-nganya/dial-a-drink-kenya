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
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy dialadrink-admin \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "REACT_APP_API_URL=https://dialadrink-backend-910510650031.us-central1.run.app/api" \
  --memory 256Mi

echo ""
echo "✅ Admin Frontend deployed successfully!"
echo "📋 Service URL:"
gcloud run services describe dialadrink-admin --format="value(status.url)"


