#!/bin/bash
# Deploy Frontend Services to Production

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Deploying Frontend Services to Production"
echo "============================================"
echo ""

# Deploy Admin Frontend
echo -e "${GREEN}📦 Step 1: Deploying Admin Frontend...${NC}"
cd admin-frontend

if [ ! -f "cloudbuild.yaml" ]; then
    echo -e "${RED}❌ cloudbuild.yaml not found in admin-frontend/${NC}"
    exit 1
fi

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"
echo ""

# Get Google Maps API Key from environment or secret
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GOOGLE_MAPS_API_KEY not set. Build may fail if required.${NC}"
    echo "Building and deploying admin frontend..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=_SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Admin frontend deployment failed${NC}"
        exit 1
    }
else
    echo "Building and deploying admin frontend with API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=_SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Admin frontend deployment failed${NC}"
        exit 1
    }
fi

ADMIN_URL=$(gcloud run services describe "$ADMIN_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

if [ -z "$ADMIN_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not retrieve admin frontend URL${NC}"
else
    echo -e "${GREEN}✅ Admin frontend deployed: $ADMIN_URL${NC}"
fi

cd ..
echo ""

# Deploy Customer Frontend
echo -e "${GREEN}📦 Step 2: Deploying Customer Frontend...${NC}"
cd frontend

if [ ! -f "cloudbuild.yaml" ]; then
    echo -e "${RED}❌ cloudbuild.yaml not found in frontend/${NC}"
    exit 1
fi

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"
echo ""

# Get Google Maps API Key from environment or secret
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GOOGLE_MAPS_API_KEY not set. Build may fail if required.${NC}"
    echo "Building and deploying customer frontend..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=_SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Customer frontend deployment failed${NC}"
        exit 1
    }
else
    echo "Building and deploying customer frontend with API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=_SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Customer frontend deployment failed${NC}"
        exit 1
    }
fi

CUSTOMER_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

if [ -z "$CUSTOMER_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not retrieve customer frontend URL${NC}"
else
    echo -e "${GREEN}✅ Customer frontend deployed: $CUSTOMER_URL${NC}"
fi

cd ..
echo ""

# Summary
echo -e "${GREEN}✅ Frontend Deployment Summary:${NC}"
echo "=============================================="
if [ -n "$ADMIN_URL" ]; then
    echo "✓ Admin frontend: $ADMIN_URL"
else
    echo "✗ Admin frontend: Not deployed"
fi
if [ -n "$CUSTOMER_URL" ]; then
    echo "✓ Customer frontend: $CUSTOMER_URL"
else
    echo "✗ Customer frontend: Not deployed"
fi
echo ""
