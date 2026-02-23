#!/bin/bash
# Check Build Status and Deploy Backend

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE="deliveryos-production-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-prod"

echo "🔍 Checking Build Status and Deploying Backend"
echo "=============================================="
echo ""

# Check for ongoing builds
echo "1. Checking for ongoing builds..."
ONGOING_BUILDS=$(gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" 2>/dev/null)
if [ -n "$ONGOING_BUILDS" ]; then
    echo "⚠️  Found ongoing builds. Waiting for completion..."
    echo "$ONGOING_BUILDS" | while read build_id; do
        echo "  Waiting for: $build_id"
        gcloud builds wait "$build_id" --project "$PROJECT_ID" || echo "  Build completed or failed"
    done
    echo "✅ All builds completed"
else
    echo "✅ No ongoing builds"
fi
echo ""

# Get latest image
echo "2. Finding latest backend image..."
# Get just the tag (not full path)
LATEST_TAG=$(gcloud container images list-tags gcr.io/$PROJECT_ID/deliveryos-backend-prod \
    --limit=1 \
    --format="value(tags[0])" \
    --sort-by=~timestamp 2>/dev/null)

if [ -z "$LATEST_TAG" ]; then
    echo "❌ No images found. Building new one..."
    cd backend
    IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-prod:$(date +%s)"
    echo "Building: $IMAGE_TAG"
    gcloud builds submit --tag "$IMAGE_TAG" .
    LATEST_IMAGE="$IMAGE_TAG"
    cd ..
else
    # Construct full image path
    LATEST_IMAGE="gcr.io/$PROJECT_ID/deliveryos-backend-prod:$LATEST_TAG"
    echo "✅ Found image: $LATEST_IMAGE"
    
    # Verify image exists
    echo "Verifying image exists..."
    if ! gcloud container images describe "$LATEST_IMAGE" &>/dev/null; then
        echo "⚠️  Image not found, building new one..."
        cd backend
        IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-prod:$(date +%s)"
        echo "Building: $IMAGE_TAG"
        gcloud builds submit --tag "$IMAGE_TAG" .
        LATEST_IMAGE="$IMAGE_TAG"
        cd ..
    else
        echo "✅ Image verified"
    fi
fi
echo ""

# Get current env vars
echo "3. Getting current environment variables..."
CURRENT_ENV=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

FRONTEND_URL=$(echo "$CURRENT_ENV" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "https://ruakadrinksdelivery.co.ke")
ADMIN_URL=$(echo "$CURRENT_ENV" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "https://dial-a-drink-admin.netlify.app")
GOOGLE_CLOUD_PROJECT=$(echo "$CURRENT_ENV" | grep -oP "GOOGLE_CLOUD_PROJECT.*?value': '\K[^']*" || echo "$PROJECT_ID")
GCP_PROJECT=$(echo "$CURRENT_ENV" | grep -oP "GCP_PROJECT.*?value': '\K[^']*" || echo "$PROJECT_ID")

echo "   FRONTEND_URL: $FRONTEND_URL"
echo "   ADMIN_URL: $ADMIN_URL"
echo ""

# Deploy
echo "4. Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
    --image "$LATEST_IMAGE" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/${CONNECTION_NAME},FRONTEND_URL=${FRONTEND_URL},ADMIN_URL=${ADMIN_URL},GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT},GCP_PROJECT=${GCP_PROJECT},HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project "$PROJECT_ID"

echo ""
echo "5. Verifying deployment..."
NEW_REVISION=$(gcloud run revisions list --service "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 1 \
    --format="value(metadata.name)" 2>/dev/null)

SERVICE_URL=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null)

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo "New Revision: ${NEW_REVISION:-'Could not verify'}"
echo "Service URL: ${SERVICE_URL:-'Not found'}"
echo ""
