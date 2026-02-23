#!/bin/bash

# Production Deployment Script
# This script deploys all components to production:
# - Backend: deliveryos-production-backend
# - Admin Frontend: deliveryos-admin-frontend
# - Customer Frontend: deliveryos-customer-frontend
# - Android App: productionDebug variant

set -e

echo "🚀 Starting production deployment..."
echo "===================================="

# Configuration
PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
DB_INSTANCE="dialadrink-db-prod"
DB_CONNECTION="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- 1. Git Operations ---
echo ""
echo "--- 1. Git Operations ---"
echo "Current branch: $(git branch --show-current)"

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  Not on main branch. Switching to main...${NC}"
    git checkout main
fi

# Check for uncommitted changes and handle them
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected. Staging and committing...${NC}"
    git add -A
    git commit -m "Deploy to production: Update deployment script and changes" || {
        echo -e "${YELLOW}⚠️  No changes to commit or already committed${NC}"
    }
fi

# Merge develop into main
echo "Merging develop into main..."
git merge develop --no-edit || {
    echo -e "${RED}❌ Merge failed. Please resolve conflicts manually.${NC}"
    exit 1
}

# Push to main
echo "Pushing to main..."
git push origin main || {
    echo -e "${YELLOW}⚠️  Push to main failed. Continuing with deployment...${NC}"
}

# --- 2. Set GCloud Project ---
echo ""
echo "--- 2. Setting GCloud Project ---"
gcloud config set project "$PROJECT_ID" || {
    echo -e "${RED}❌ Failed to set gcloud project${NC}"
    exit 1
}

# --- 3. Database Migrations ---
echo ""
echo "--- 3. Database Migrations ---"
echo "Running database migrations for penalties and loans tables..."

cd backend

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set. Attempting to construct from Cloud SQL...${NC}"
    # Construct DATABASE_URL from Cloud SQL connection
    DB_USER="${DB_USER:-dialadrink_app}"
    DB_PASS="${DB_PASS:-$(gcloud secrets versions access latest --secret=db-password --project=$PROJECT_ID 2>/dev/null || echo '')}"
    DB_NAME="${DB_NAME:-dialadrink_prod}"
    
    if [ -z "$DB_PASS" ]; then
        echo -e "${YELLOW}⚠️  Could not retrieve DB password. Skipping migrations.${NC}"
        echo -e "${YELLOW}⚠️  Please run migrations manually:${NC}"
        echo "   NODE_ENV=production DATABASE_URL='postgresql://user:pass@/db?host=/cloudsql/$DB_CONNECTION' node scripts/create-penalties-table-direct.js"
    else
        export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${DB_CONNECTION}"
        node scripts/create-penalties-table-direct.js || {
            echo -e "${YELLOW}⚠️  Migration script failed. Continuing with deployment...${NC}"
        }
    fi
else
    NODE_ENV=production node scripts/create-penalties-table-direct.js || {
        echo -e "${YELLOW}⚠️  Migration script failed. Continuing with deployment...${NC}"
    }
fi

cd ..

# --- 4. Backend Deployment ---
echo ""
echo "--- 4. Backend Deployment ---"
echo "Deploying backend to: $BACKEND_SERVICE"

cd backend

# Generate SHORT_SHA for image tagging
SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)

echo "Building and deploying backend..."
echo "Using SHORT_SHA: $SHORT_SHA"
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA \
    --project "$PROJECT_ID" \
    . || {
    echo -e "${RED}❌ Backend deployment failed${NC}"
    exit 1
}

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo -e "${YELLOW}⚠️  Could not retrieve backend URL${NC}"
else
    echo -e "${GREEN}✅ Backend deployed: $BACKEND_URL${NC}"
fi

cd ..

# --- 5. Admin Frontend Deployment ---
echo ""
echo "--- 5. Admin Frontend Deployment ---"
echo "Deploying admin frontend to: $ADMIN_FRONTEND_SERVICE"

cd admin-frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)

echo "Building and deploying admin frontend..."
echo "Using SHORT_SHA: $SHORT_SHA"
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA \
    --project "$PROJECT_ID" \
    . || {
    echo -e "${RED}❌ Admin frontend deployment failed${NC}"
    exit 1
}

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

# --- 6. Customer Frontend Deployment ---
echo ""
echo "--- 6. Customer Frontend Deployment ---"
echo "Deploying customer frontend to: $CUSTOMER_FRONTEND_SERVICE"

cd frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)

echo "Building and deploying customer frontend..."
echo "Using SHORT_SHA: $SHORT_SHA"
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA \
    --project "$PROJECT_ID" \
    . || {
    echo -e "${RED}❌ Customer frontend deployment failed${NC}"
    exit 1
}

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

# --- 7. Android App Build ---
echo ""
echo "--- 7. Android App Build ---"
echo "Building productionDebug variant..."

cd driver-app-native

# Check if gradlew exists
if [ ! -f "./gradlew" ]; then
    echo -e "${YELLOW}⚠️  gradlew not found. Skipping Android build.${NC}"
    echo -e "${YELLOW}⚠️  Please build manually: ./gradlew assembleProductionDebug${NC}"
else
    echo "Building productionDebug variant..."
    ./gradlew assembleProductionDebug || {
        echo -e "${YELLOW}⚠️  Android build failed. Please build manually.${NC}"
    }
    
    # Find the APK
    APK_PATH=$(find app/build/outputs/apk -name "*productionDebug*.apk" | head -1)
    if [ -n "$APK_PATH" ]; then
        echo -e "${GREEN}✅ Android APK built: $APK_PATH${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not find built APK${NC}"
    fi
fi

cd ..

# --- 8. Summary ---
echo ""
echo "===================================="
echo -e "${GREEN}✅ Production Deployment Complete!${NC}"
echo "===================================="
echo ""
echo "Deployed Services:"
if [ -n "$BACKEND_URL" ]; then
    echo "  Backend: $BACKEND_URL"
fi
if [ -n "$ADMIN_URL" ]; then
    echo "  Admin Frontend: $ADMIN_URL"
fi
if [ -n "$CUSTOMER_URL" ]; then
    echo "  Customer Frontend: $CUSTOMER_URL"
fi
echo ""
echo "Next Steps:"
echo "  1. Verify all services are running correctly"
echo "  2. Test API endpoints"
echo "  3. Test frontend applications"
echo "  4. Install and test Android app (productionDebug APK)"
echo ""
echo -e "${YELLOW}Note: Development credentials are maintained in production for testing.${NC}"
echo -e "${YELLOW}Note: CORS is configured to allow production URLs.${NC}"
