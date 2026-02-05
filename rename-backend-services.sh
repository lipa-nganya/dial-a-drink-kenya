#!/bin/bash
# Rename backend services to development and production

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

echo "🔄 Renaming Backend Services"
echo "============================"
echo ""

# Get current services
echo "📋 Current services:"
gcloud run services list --region $REGION --project $PROJECT_ID --format="table(metadata.name,status.url)"

echo ""
echo "⚠️  Cloud Run doesn't support direct renaming."
echo "   We'll create new services with correct names and copy configurations."
echo ""

# Get service details
echo "📥 Getting service configurations..."

# Get deliveryos-backend config
DEV_IMAGE=$(gcloud run services describe deliveryos-backend --region $REGION --format="get(spec.template.spec.containers[0].image)" --project $PROJECT_ID)
DEV_ENV_VARS=$(gcloud run services describe deliveryos-backend --region $REGION --format="get(spec.template.spec.containers[0].env)" --project $PROJECT_ID)
DEV_CLOUDSQL=$(gcloud run services describe deliveryos-backend --region $REGION --format="get(spec.template.spec.containers[0].env[?(@.name=='DATABASE_URL')].value)" --project $PROJECT_ID 2>/dev/null || echo "")

# Get dialadrink-backend-prod config
PROD_IMAGE=$(gcloud run services describe dialadrink-backend-prod --region $REGION --format="get(spec.template.spec.containers[0].image)" --project $PROJECT_ID)
PROD_ENV_VARS=$(gcloud run services describe dialadrink-backend-prod --region $REGION --format="get(spec.template.spec.containers[0].env)" --project $PROJECT_ID)

echo "✅ Configurations retrieved"
echo ""

# Create development service
echo "🔧 Creating deliveryos-backend-dev (development)..."
gcloud run deploy deliveryos-backend-dev \
  --image "$DEV_IMAGE" \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --project $PROJECT_ID \
  --set-env-vars "$DEV_ENV_VARS" \
  --memory 512Mi \
  --timeout 300

echo ""
echo "🔧 Creating deliveryos-backend-prod (production)..."
gcloud run deploy deliveryos-backend-prod \
  --image "$PROD_IMAGE" \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --project $PROJECT_ID \
  --set-env-vars "$PROD_ENV_VARS" \
  --memory 512Mi \
  --timeout 300

echo ""
echo "✅ New services created!"
echo ""
echo "📋 New services:"
gcloud run services list --region $REGION --project $PROJECT_ID --format="table(metadata.name,status.url)" | grep -E "deliveryos-backend-dev|deliveryos-backend-prod"

echo ""
echo "⚠️  Old services (deliveryos-backend, dialadrink-backend-prod) still exist."
echo "   You can delete them after verifying the new services work correctly."
echo ""
echo "   To delete old services:"
echo "   gcloud run services delete deliveryos-backend --region $REGION --project $PROJECT_ID"
echo "   gcloud run services delete dialadrink-backend-prod --region $REGION --project $PROJECT_ID"
