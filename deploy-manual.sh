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
DB_USER="dialadrink_app"
DB_NAME="dialadrink_prod"
DB_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"

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

# Step 3: Get existing backend env vars
echo "📋 Step 3: Retrieving existing backend environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "FRONTEND_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://ruakadrinksdelivery.co.ke")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "ADMIN_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dial-a-drink-admin.netlify.app")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GOOGLE_CLOUD_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GCP_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")

echo "Frontend URL: $EXISTING_FRONTEND_URL"
echo "Admin URL: $EXISTING_ADMIN_URL"
echo ""

# Step 4: Deploy Backend
echo "🔨 Step 4: Building and deploying backend..."
cd backend

IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-prod:$(date +%s)"
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
    --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME},FRONTEND_URL=${EXISTING_FRONTEND_URL},ADMIN_URL=${EXISTING_ADMIN_URL},GOOGLE_CLOUD_PROJECT=${EXISTING_GOOGLE_CLOUD_PROJECT},GCP_PROJECT=${EXISTING_GCP_PROJECT},HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
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

# Step 5: Deploy Admin Frontend
echo "🌐 Step 5: Building and deploying admin frontend..."
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

# Step 6: Deploy Customer Frontend
echo "🌐 Step 6: Building and deploying customer frontend..."
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
