#!/bin/bash
# Deploy Backend Now - Check Build and Deploy

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE="deliveryos-production-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-prod"

echo "🔍 Checking Build Status..."
echo "=========================="

# Check ongoing builds
ONGOING=$(gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ONGOING" -gt 0 ]; then
    echo "⚠️  There are $ONGOING ongoing builds. Waiting for them to complete..."
    echo "Build IDs:"
    gcloud builds list --project "$PROJECT_ID" --ongoing --format="table(id,status,createTime)"
    echo ""
    echo "Waiting for builds to complete (this may take 5-10 minutes)..."
    gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" | while read build_id; do
        echo "Waiting for build: $build_id"
        gcloud builds wait "$build_id" --project "$PROJECT_ID" || true
    done
fi

echo ""
IMAGE_BASE="gcr.io/$PROJECT_ID/deliveryos-production-backend"

echo "📦 Getting Latest Built Image..."
LATEST_TAG=$(gcloud container images list-tags "$IMAGE_BASE" \
    --limit=1 \
    --format="value(tags[0])" \
    --sort-by=~timestamp 2>/dev/null)

if [ -z "$LATEST_TAG" ]; then
    echo "❌ No images found. Building new image..."
    cd backend
    IMAGE_TAG="${IMAGE_BASE}:$(date +%s)"
    echo "Building: $IMAGE_TAG"
    gcloud builds submit --tag "$IMAGE_TAG" .
    LATEST_IMAGE="$IMAGE_TAG"
    cd ..
else
    LATEST_IMAGE="${IMAGE_BASE}:${LATEST_TAG}"
    echo "✅ Found latest image: $LATEST_IMAGE"
fi

echo ""
echo "🚀 Deploying Backend (image only — env unchanged in GCP)..."
echo "======================"
gcloud run deploy "$SERVICE" \
    --image "$LATEST_IMAGE" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --project "$PROJECT_ID"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Verifying new revision..."
NEW_REVISION=$(gcloud run revisions list --service "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 1 \
    --format="value(metadata.name)" 2>/dev/null)

if [ -n "$NEW_REVISION" ]; then
    echo "✅ New revision created: $NEW_REVISION"
    echo ""
    echo "Service URL:"
    gcloud run services describe "$SERVICE" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(status.url)"
else
    echo "⚠️  Could not verify new revision"
fi
