#!/bin/bash
# Deploy Backend to Google Cloud Run
# This script preserves existing environment variables

set -e

echo "🚀 Deploying Backend to Google Cloud Run..."
echo ""

cd "$(dirname "$0")/backend"

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build and push image
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/drink-suite/liquoros-backend .

# Deploy to Cloud Run
# Note: We only set NODE_ENV here. Other env vars should be set via sync-env-to-cloud-run.sh
# This preserves existing environment variables
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy liquoros-backend \
  --image gcr.io/drink-suite/liquoros-backend \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "NODE_ENV=production" \
  --memory 512Mi \
  --timeout 300

echo ""
echo "✅ Backend deployed successfully!"
echo "📋 Service URL:"
gcloud run services describe liquoros-backend --format="value(status.url)"
echo ""
echo "💡 Note: Environment variables are preserved during deployment."
echo "   To update env vars, use: ./sync-env-to-cloud-run.sh"
