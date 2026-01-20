#!/bin/bash
# Deploy Backend to Google Cloud Run
# This script preserves existing environment variables
#
# ⚠️ IMPORTANT: This deploys to the CLOUD/DEV backend service
# Service Name: deliveryos-backend
# Expected URL: https://deliveryos-backend-p6bkgryxqa-uc.a.run.app
#
# 📋 BEFORE DEPLOYING: Review BACKEND_PRE_DEPLOYMENT_CHECKLIST.md
# 📚 For detailed info: See BACKEND_DEPLOYMENT_GUIDE.md
# 📖 General deployment: See DEPLOYMENT_GUIDE.md

set -e

echo "🚀 Deploying Backend to Google Cloud Run..."
echo "📋 Target Service: deliveryos-backend (Cloud/Dev)"
echo ""

cd "$(dirname "$0")/backend"

# Set project and region
gcloud config set project drink-suite
gcloud config set run/region us-central1

# Build and push image
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/drink-suite/deliveryos-backend .

# Deploy to Cloud Run
# CRITICAL: Preserve FRONTEND_URL and ADMIN_URL for CORS (Netlify domains)
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe deliveryos-backend --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "")
FRONTEND_URL_VALUE="${EXISTING_FRONTEND_URL:-https://dialadrink.thewolfgang.tech}"
ADMIN_URL_VALUE="${EXISTING_ADMIN_URL:-https://dialadrink-admin.thewolfgang.tech}"
echo "   FRONTEND_URL: $FRONTEND_URL_VALUE"
echo "   ADMIN_URL: $ADMIN_URL_VALUE"
echo ""

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy deliveryos-backend \
  --image gcr.io/drink-suite/deliveryos-backend \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "NODE_ENV=production,FRONTEND_URL=$FRONTEND_URL_VALUE,ADMIN_URL=$ADMIN_URL_VALUE" \
  --memory 512Mi \
  --timeout 300

echo ""
echo "✅ Backend deployed successfully!"
echo "📋 Service URL:"
gcloud run services describe deliveryos-backend --format="value(status.url)"
echo ""
echo "💡 Note: Environment variables are preserved during deployment."
echo "   To update env vars, use: ./sync-env-to-cloud-run.sh"
