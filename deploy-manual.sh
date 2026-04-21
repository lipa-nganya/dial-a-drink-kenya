#!/bin/bash
# Manual Production Deployment with Full Logging

set -e
set -x  # Enable debug mode

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-prod"

LOG_FILE="/tmp/deployment-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "🚀 Starting Manual Production Deployment"
echo "========================================="
echo "Log file: $LOG_FILE"
echo "Time: $(date)"
echo ""

# Step 1: Configure gcloud
echo "🔐 Step 1: Configuring gcloud..."
gcloud config set project "$PROJECT_ID"
gcloud config set account dialadrinkkenya254@gmail.com || echo "Account may need authentication"
echo "✅ gcloud configured"
echo ""

# Step 2: Check current service status
echo "📊 Step 2: Checking current service status..."
gcloud run services list --region "$REGION" --project "$PROJECT_ID" --format="table(metadata.name,status.url,status.conditions[0].status)"
echo ""

# Step 3: Deploy Backend (image only — secrets stay in GCP)
echo "📋 Step 3: Building and deploying backend (env unchanged on service)..."
cd backend

IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-production-backend:$(date +%s)"
echo "Image tag: $IMAGE_TAG"

echo "Building Docker image..."
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo "❌ Backend build failed"
    exit 1
}

echo "✅ Backend image built: $IMAGE_TAG"
echo ""

echo "Deploying to Cloud Run..."
gcloud run deploy "$BACKEND_SERVICE" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --project "$PROJECT_ID" || {
    echo "❌ Backend deployment failed"
    exit 1
}

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

echo "✅ Backend deployed: $BACKEND_URL"
cd ..
echo ""

# Step 4: Deploy Admin Frontend
echo "🌐 Step 4: Building and deploying admin frontend..."
cd admin-frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"

# Try to get Google Maps API key
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" \
        . || {
        echo "❌ Admin frontend deployment failed"
        exit 1
    }
else
    echo "⚠️  Google Maps API key not found, building without it..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo "❌ Admin frontend deployment failed"
        exit 1
    }
fi

ADMIN_URL=$(gcloud run services describe "$ADMIN_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Admin frontend deployed: ${ADMIN_URL:-'URL not found'}"
cd ..
echo ""

# Step 5: Deploy Customer Frontend
echo "🌐 Step 5: Building and deploying customer frontend..."
cd frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" \
        . || {
        echo "❌ Customer frontend deployment failed"
        exit 1
    }
else
    echo "⚠️  Google Maps API key not found, building without it..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo "❌ Customer frontend deployment failed"
        exit 1
    }
fi

CUSTOMER_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Customer frontend deployed: ${CUSTOMER_URL:-'URL not found'}"
cd ..
echo ""

# Summary
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
echo "Backend: $BACKEND_URL"
echo "Admin Frontend: ${ADMIN_URL:-'Not found'}"
echo "Customer Frontend: ${CUSTOMER_URL:-'Not found'}"
echo ""
echo "Log file: $LOG_FILE"
echo ""
