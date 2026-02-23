#!/bin/bash
# Deploy Frontend Services to Production

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🌐 Deploying Frontend Services to Production"
echo "============================================="
echo ""

# Get Google Maps API Key
echo "1. Checking for Google Maps API Key..."
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "✅ Google Maps API key found"
else
    echo -e "${YELLOW}⚠️  Google Maps API key not found. Build may fail if required.${NC}"
fi
echo ""

# Deploy Admin Frontend
echo "2. Deploying Admin Frontend..."
echo "==============================="
cd admin-frontend

if [ ! -f "cloudbuild.yaml" ]; then
    echo -e "${RED}❌ cloudbuild.yaml not found in admin-frontend/${NC}"
    exit 1
fi

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"
echo ""

# Check for ongoing builds
ONGOING=$(gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ONGOING" -gt 0 ]; then
    echo "⚠️  Waiting for $ONGOING ongoing builds to complete..."
    gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" | while read build_id; do
        echo "  Waiting for: $build_id"
        gcloud builds wait "$build_id" --project "$PROJECT_ID" || echo "  Build completed"
    done
fi

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" . || {
        echo -e "${RED}❌ Admin frontend deployment failed${NC}"
        exit 1
    }
else
    echo "Building without Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" . || {
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
echo "3. Deploying Customer Frontend..."
echo "=================================="
cd frontend

if [ ! -f "cloudbuild.yaml" ]; then
    echo -e "${RED}❌ cloudbuild.yaml not found in frontend/${NC}"
    exit 1
fi

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)
echo "Using SHORT_SHA: $SHORT_SHA"
echo ""

# Check for ongoing builds
ONGOING=$(gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ONGOING" -gt 0 ]; then
    echo "⚠️  Waiting for $ONGOING ongoing builds to complete..."
    gcloud builds list --project "$PROJECT_ID" --ongoing --format="value(id)" | while read build_id; do
        echo "  Waiting for: $build_id"
        gcloud builds wait "$build_id" --project "$PROJECT_ID" || echo "  Build completed"
    done
fi

if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
    echo "Building with Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY \
        --project "$PROJECT_ID" . || {
        echo -e "${RED}❌ Customer frontend deployment failed${NC}"
        exit 1
    }
else
    echo "Building without Google Maps API key..."
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" . || {
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
echo "========================================="
echo -e "${GREEN}✅ Frontend Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Service URLs:"
if [ -n "$ADMIN_URL" ]; then
    echo "  Admin Frontend: $ADMIN_URL"
else
    echo "  Admin Frontend: Not found (check manually)"
fi
if [ -n "$CUSTOMER_URL" ]; then
    echo "  Customer Frontend: $CUSTOMER_URL"
else
    echo "  Customer Frontend: Not found (check manually)"
fi
echo ""
echo "Verifying revisions..."
echo ""
echo "Admin Frontend latest revision:"
gcloud run revisions list --service "$ADMIN_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 1 \
    --format="value(metadata.name,metadata.creationTimestamp)" 2>/dev/null || echo "Could not verify"
echo ""
echo "Customer Frontend latest revision:"
gcloud run revisions list --service "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --limit 1 \
    --format="value(metadata.name,metadata.creationTimestamp)" 2>/dev/null || echo "Could not verify"
echo ""
