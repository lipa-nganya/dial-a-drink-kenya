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
IMAGE_BASE="gcr.io/$PROJECT_ID/deliveryos-production-backend"

echo "2. Finding latest backend image..."
LATEST_TAG=$(gcloud container images list-tags "$IMAGE_BASE" \
    --limit=1 \
    --format="value(tags[0])" \
    --sort-by=~timestamp 2>/dev/null)

if [ -z "$LATEST_TAG" ]; then
    echo "❌ No images found. Building new one..."
    cd backend
    IMAGE_TAG="${IMAGE_BASE}:$(date +%s)"
    echo "Building: $IMAGE_TAG"
    gcloud builds submit --tag "$IMAGE_TAG" .
    LATEST_IMAGE="$IMAGE_TAG"
    cd ..
else
    LATEST_IMAGE="${IMAGE_BASE}:${LATEST_TAG}"
    echo "✅ Found image: $LATEST_IMAGE"

    echo "Verifying image exists..."
    if ! gcloud container images describe "$LATEST_IMAGE" &>/dev/null; then
        echo "⚠️  Image not found, building new one..."
        cd backend
        IMAGE_TAG="${IMAGE_BASE}:$(date +%s)"
        echo "Building: $IMAGE_TAG"
        gcloud builds submit --tag "$IMAGE_TAG" .
        LATEST_IMAGE="$IMAGE_TAG"
        cd ..
    else
        echo "✅ Image verified"
    fi
fi
echo ""

# Deploy (image only — DATABASE_URL and other secrets unchanged in GCP)
echo "3. Deploying to Cloud Run..."
gcloud run deploy "$SERVICE" \
    --image "$LATEST_IMAGE" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --project "$PROJECT_ID"

echo ""
echo "4. Verifying deployment..."
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
