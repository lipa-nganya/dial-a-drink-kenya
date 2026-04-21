#!/bin/bash
# Roll new backend container images for development and production Cloud Run services.
#
# Does NOT embed DATABASE_URL or other secrets — those stay in GCP (Console / Secret Manager).
# Requires services to exist with env already configured. First-time setup: set DATABASE_URL
# and related vars in Cloud Run before using this script.

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

DEV_SERVICE="deliveryos-development-backend"
DEV_CONNECTION="dialadrink-production:us-central1:dialadrink-db-dev"
DEV_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-backend-dev"

PROD_SERVICE="deliveryos-production-backend"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"
PROD_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-production-backend"

echo "🚀 Rolling backend images (dev + prod)"
echo "========================================"
echo "   Project: $PROJECT_ID"
echo "   Dev service:  $DEV_SERVICE"
echo "   Prod service: $PROD_SERVICE"
echo ""

gcloud config set project "$PROJECT_ID"

echo "📦 Building development backend image..."
cd backend
DEV_TAG="${DEV_IMAGE}:$(date +%s)"
gcloud builds submit --tag "$DEV_TAG" .
cd ..

echo ""
echo "🔧 Deploying $DEV_SERVICE (image only; env unchanged)..."
gcloud run deploy "$DEV_SERVICE" \
  --image "$DEV_TAG" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances="$DEV_CONNECTION" \
  --project "$PROJECT_ID"

echo ""
echo "📦 Building production backend image..."
cd backend
PROD_TAG="${PROD_IMAGE}:$(date +%s)"
gcloud builds submit --tag "$PROD_TAG" .
cd ..

echo ""
echo "🔧 Deploying $PROD_SERVICE (image only; env unchanged)..."
gcloud run deploy "$PROD_SERVICE" \
  --image "$PROD_TAG" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances="$PROD_CONNECTION" \
  --project "$PROJECT_ID"

echo ""
echo "✅ Backend images rolled."
echo ""
gcloud run services list --region "$REGION" --format="table(metadata.name,status.url)" --project "$PROJECT_ID"

echo ""
echo "📝 Next steps:"
echo "  1. Verify health: curl \$(gcloud run services describe $DEV_SERVICE --region=$REGION --project=$PROJECT_ID --format='value(status.url)')/api/health"
echo "  2. Update frontend / driver app API URLs if services were new"
echo "  3. Schema changes: run migration scripts manually when needed (not part of this script)"
