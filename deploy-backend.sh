#!/bin/bash
# Deploy Backend to Google Cloud Run

set -e

echo "🚀 Deploying Backend to Google Cloud Run..."
echo ""

cd "$(dirname "$0")/backend"

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build and push image
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/drink-suite/dialadrink-backend .

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy dialadrink-backend \
  --image gcr.io/drink-suite/dialadrink-backend \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,PORT=8080" \
  --memory 512Mi \
  --timeout 300

echo ""
echo "✅ Backend deployed successfully!"
echo "📋 Service URL:"
gcloud run services describe dialadrink-backend --format="value(status.url)"


