#!/bin/bash
# Deploy Frontend Services to Production (Fixed)

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

# Get Google Maps API Key (try secret manager, then env var)
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GOOGLE_MAPS_API_KEY not found in secrets or environment${NC}"
    echo -e "${YELLOW}⚠️  Build will proceed but may fail if API key is required${NC}"
    echo ""
fi

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

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Admin frontend deployment failed${NC}"
        exit 1
    }
else
    echo "Building without Google Maps API key (may fail if required)..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Admin frontend deployment failed${NC}"
        echo -e "${YELLOW}💡 Tip: Set GOOGLE_MAPS_API_KEY environment variable or add to Secret Manager${NC}"
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

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Customer frontend deployment failed${NC}"
        exit 1
    }
else
    echo "Building without Google Maps API key (may fail if required)..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Customer frontend deployment failed${NC}"
        echo -e "${YELLOW}💡 Tip: Set GOOGLE_MAPS_API_KEY environment variable or add to Secret Manager${NC}"
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
    echo "✗ Admin frontend: Not deployed or URL not found"
fi
if [ -n "$CUSTOMER_URL" ]; then
    echo "✓ Customer frontend: $CUSTOMER_URL"
else
    echo "✗ Customer frontend: Not deployed or URL not found"
fi
echo ""
