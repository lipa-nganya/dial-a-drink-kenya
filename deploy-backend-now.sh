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
echo "📦 Getting Latest Built Image..."
LATEST_IMAGE=$(gcloud container images list-tags gcr.io/$PROJECT_ID/deliveryos-backend-prod \
    --limit=1 \
    --format="value(tags[0])" \
    --sort-by=~timestamp 2>/dev/null)

if [ -z "$LATEST_IMAGE" ]; then
    echo "❌ No images found. Building new image..."
    cd backend
    IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-prod:$(date +%s)"
    echo "Building: $IMAGE_TAG"
    gcloud builds submit --tag "$IMAGE_TAG" .
    LATEST_IMAGE="$IMAGE_TAG"
    cd ..
else
    echo "✅ Found latest image: $LATEST_IMAGE"
fi

echo ""
echo "📋 Getting Current Environment Variables..."
CURRENT_ENV=$(gcloud run services describe "$SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract env vars
FRONTEND_URL=$(echo "$CURRENT_ENV" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "https://ruakadrinksdelivery.co.ke")
ADMIN_URL=$(echo "$CURRENT_ENV" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "https://dial-a-drink-admin.netlify.app")
GOOGLE_CLOUD_PROJECT=$(echo "$CURRENT_ENV" | grep -oP "GOOGLE_CLOUD_PROJECT.*?value': '\K[^']*" || echo "$PROJECT_ID")
GCP_PROJECT=$(echo "$CURRENT_ENV" | grep -oP "GCP_PROJECT.*?value': '\K[^']*" || echo "$PROJECT_ID")

echo "Frontend URL: $FRONTEND_URL"
echo "Admin URL: $ADMIN_URL"
echo ""

echo "🚀 Deploying Backend..."
echo "======================"
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
