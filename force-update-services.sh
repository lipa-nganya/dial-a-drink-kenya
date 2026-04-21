#!/bin/bash
# Force Update All Production Services

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-prod"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Checking Service Status and Forcing Updates"
echo "==============================================="
echo ""

# Function to get service last update time
get_last_update() {
    local service=$1
    gcloud run services describe "$service" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format="value(metadata.creationTimestamp)" 2>/dev/null || echo "NOT_FOUND"
}

# Function to check if service needs update (older than 10 minutes)
needs_update() {
    local service=$1
    local last_update=$(get_last_update "$service")
    if [ "$last_update" = "NOT_FOUND" ]; then
        return 0  # Needs update if not found
    fi
    
    # Convert to timestamp and check if older than 10 minutes
    local timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${last_update%.*}" "+%s" 2>/dev/null || echo "0")
    local now=$(date +%s)
    local diff=$((now - timestamp))
    
    if [ $diff -gt 600 ]; then  # 10 minutes = 600 seconds
        return 0  # Needs update
    else
        return 1  # Doesn't need update
    fi
}

# Check and update Backend
echo "📊 Checking Backend Service..."
BACKEND_LAST_UPDATE=$(get_last_update "$BACKEND_SERVICE")
echo "Last update: $BACKEND_LAST_UPDATE"

if needs_update "$BACKEND_SERVICE"; then
    echo -e "${YELLOW}⚠️  Backend needs update. Deploying...${NC}"
    cd backend

    IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-production-backend:force-$(date +%s)"
    echo "Building: $IMAGE_TAG"
    gcloud builds submit --tag "$IMAGE_TAG" . || {
        echo -e "${RED}❌ Backend build failed${NC}"
        exit 1
    }

    echo "Deploying new revision (image only; env unchanged in GCP)..."
    gcloud run deploy "$BACKEND_SERVICE" \
        --image "$IMAGE_TAG" \
        --platform managed \
        --region "$REGION" \
        --allow-unauthenticated \
        --add-cloudsql-instances "$CONNECTION_NAME" \
        --project "$PROJECT_ID" || {
        echo -e "${RED}❌ Backend deployment failed${NC}"
        exit 1
    }
    
    echo -e "${GREEN}✅ Backend updated${NC}"
    cd ..
else
    echo -e "${GREEN}✓ Backend is up to date${NC}"
fi
echo ""

# Check and update Admin Frontend
echo "📊 Checking Admin Frontend Service..."
ADMIN_LAST_UPDATE=$(get_last_update "$ADMIN_FRONTEND_SERVICE")
echo "Last update: $ADMIN_LAST_UPDATE"

if needs_update "$ADMIN_FRONTEND_SERVICE"; then
    echo -e "${YELLOW}⚠️  Admin frontend needs update. Deploying...${NC}"
    cd admin-frontend
    
    SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
    GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"
    
    if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
        gcloud builds submit \
            --config cloudbuild.yaml \
            --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
            --project "$PROJECT_ID" . || {
            echo -e "${RED}❌ Admin frontend deployment failed${NC}"
            exit 1
        }
    else
        gcloud builds submit \
            --config cloudbuild.yaml \
            --substitutions=SHORT_SHA=$SHORT_SHA \
            --project "$PROJECT_ID" . || {
            echo -e "${RED}❌ Admin frontend deployment failed${NC}"
            exit 1
        }
    fi
    
    echo -e "${GREEN}✅ Admin frontend updated${NC}"
    cd ..
else
    echo -e "${GREEN}✓ Admin frontend is up to date${NC}"
fi
echo ""

# Check and update Customer Frontend
echo "📊 Checking Customer Frontend Service..."
CUSTOMER_LAST_UPDATE=$(get_last_update "$CUSTOMER_FRONTEND_SERVICE")
echo "Last update: $CUSTOMER_LAST_UPDATE"

if needs_update "$CUSTOMER_FRONTEND_SERVICE"; then
    echo -e "${YELLOW}⚠️  Customer frontend needs update. Deploying...${NC}"
    cd frontend
    
    SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
    GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"
    
    if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
        gcloud builds submit \
            --config cloudbuild.yaml \
            --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
            --project "$PROJECT_ID" . || {
            echo -e "${RED}❌ Customer frontend deployment failed${NC}"
            exit 1
        }
    else
        gcloud builds submit \
            --config cloudbuild.yaml \
            --substitutions=SHORT_SHA=$SHORT_SHA \
            --project "$PROJECT_ID" . || {
            echo -e "${RED}❌ Customer frontend deployment failed${NC}"
            exit 1
        }
    fi
    
    echo -e "${GREEN}✅ Customer frontend updated${NC}"
    cd ..
else
    echo -e "${GREEN}✓ Customer frontend is up to date${NC}"
fi
echo ""

# Final status
echo "========================================="
echo "✅ Update Complete!"
echo "========================================="
echo ""
echo "Service URLs:"
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null)
ADMIN_URL=$(gcloud run services describe "$ADMIN_FRONTEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null)
CUSTOMER_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null)

echo "Backend: $BACKEND_URL"
echo "Admin Frontend: ${ADMIN_URL:-'Not found'}"
echo "Customer Frontend: ${CUSTOMER_URL:-'Not found'}"
echo ""
