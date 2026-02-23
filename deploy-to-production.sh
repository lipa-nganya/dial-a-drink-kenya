#!/bin/bash
# Deploy to Production Environment
# This script handles:
# 1. Database migrations (pushToken column)
# 2. Backend deployment to Google Cloud Run (production)
# 3. Frontend deployments to Google Cloud Run (production)
# 4. Git push to GitHub
# 5. Android app build instructions

set -e  # Exit on error
set -x  # Debug mode - show commands as they execute

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
GCLOUD_ACCOUNT="dialadrinkkenya254@gmail.com"
INSTANCE_NAME="dialadrink-db-prod"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-prod"
DB_USER="dialadrink_app"
DB_NAME="dialadrink_prod"
DB_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"

echo -e "${BLUE}🚀 Deploying to Production Environment${NC}"
echo "=============================================="
echo ""

# Step 1: Authenticate and set gcloud project
echo -e "${GREEN}🔐 Step 1: Setting up gcloud...${NC}"
gcloud config set account "$GCLOUD_ACCOUNT" || {
    echo -e "${YELLOW}⚠️  Account authentication may be needed. Run: gcloud auth login${NC}"
}
gcloud config set project "$PROJECT_ID"
echo "✅ Project set to: $PROJECT_ID"
echo ""

# Step 2: Git Operations
echo -e "${GREEN}📋 Step 2: Git Operations...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we're on main branch
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
    echo -e "${YELLOW}⚠️  Not on main branch. Switching to main...${NC}"
    git checkout main 2>/dev/null || git checkout master 2>/dev/null || {
        echo -e "${RED}❌ Could not switch to main/master branch${NC}"
        exit 1
    }
    CURRENT_BRANCH=$(git branch --show-current)
fi

# Check for uncommitted changes and handle them
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes detected. Staging and committing...${NC}"
    git add -A
    git commit -m "Deploy to production: Update deployment script and changes" || {
        echo -e "${YELLOW}⚠️  No changes to commit or already committed${NC}"
    }
fi

# Merge develop into main if on main
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    echo "Merging develop into $CURRENT_BRANCH..."
    git merge develop --no-edit || {
        echo -e "${YELLOW}⚠️  Merge failed or no changes to merge. Continuing...${NC}"
    }
    
    # Push to GitHub
    echo "Pushing to $CURRENT_BRANCH..."
    git push origin "$CURRENT_BRANCH" || {
        echo -e "${YELLOW}⚠️  Push failed or already up to date. Continuing...${NC}"
    }
fi
echo ""

# Step 3: Run database migration for pushToken column
echo -e "${GREEN}🗄️  Step 3: Running database migration (pushToken column)...${NC}"
cd backend

# The migration will run automatically on server start via addMissingColumns()
# But we can also run it manually to ensure it's done
echo "Note: pushToken column will be added automatically on server start"
echo "Running manual migration check..."
node scripts/add-push-token-column.js 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Manual migration check failed (may already exist or need Cloud SQL connection)${NC}"
    echo "Migration will run automatically when server starts"
}

cd ..
echo ""

# Step 4: Deploy backend to Google Cloud Run
echo -e "${GREEN}☁️  Step 4: Deploying backend to Google Cloud Run...${NC}"
echo "Service: $BACKEND_SERVICE"
echo "Region: $REGION"
echo ""

cd backend

# Get existing environment variables to preserve them
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract existing values or use production defaults
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "FRONTEND_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://ruakadrinksdelivery.co.ke")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "ADMIN_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dial-a-drink-admin.netlify.app")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GOOGLE_CLOUD_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GCP_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")

# Build and push image
echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-prod:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

echo "✅ Image built successfully"
echo ""

# Deploy to Cloud Run (update existing service, don't create new)
echo "🚀 Deploying to Cloud Run (updating existing service)..."
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
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
}

# Get final service URL
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

echo ""
echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
echo "🌐 Service URL: $BACKEND_URL"
echo ""

cd ..

# Step 5: Deploy Admin Frontend to Google Cloud Run
echo -e "${GREEN}🌐 Step 5: Deploying Admin Frontend to Google Cloud Run...${NC}"
echo "Service: $ADMIN_FRONTEND_SERVICE"
echo ""

cd admin-frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)

# Get Google Maps API Key from environment or secret
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

echo "Building and deploying admin frontend..."
echo "Using SHORT_SHA: $SHORT_SHA"
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GOOGLE_MAPS_API_KEY not set. Build may fail if required.${NC}"
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=_SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Admin frontend deployment failed${NC}"
        exit 1
    }
else
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

# Step 6: Deploy Customer Frontend to Google Cloud Run
echo -e "${GREEN}🌐 Step 6: Deploying Customer Frontend to Google Cloud Run...${NC}"
echo "Service: $CUSTOMER_FRONTEND_SERVICE"
echo ""

cd frontend

SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum | head -c 8)

# Get Google Maps API Key from environment or secret
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"

echo "Building and deploying customer frontend..."
echo "Using SHORT_SHA: $SHORT_SHA"
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  GOOGLE_MAPS_API_KEY not set. Build may fail if required.${NC}"
    gcloud builds submit \
        --config cloudbuild.yaml \
        --substitutions=_SHORT_SHA=$SHORT_SHA \
        --project "$PROJECT_ID" \
        . || {
        echo -e "${RED}❌ Customer frontend deployment failed${NC}"
        exit 1
    }
else
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

# Step 7: Android app build instructions
echo -e "${GREEN}📱 Step 7: Android App Build${NC}"
echo "=============================================="
echo "To build the Android app for production:"
echo ""
echo "  cd driver-app-native"
echo "  ./gradlew assembleProductionDebug"
echo ""
echo "APK will be at:"
echo "  app/build/outputs/apk/production/debug/app-production-debug.apk"
echo ""

# Step 8: Summary
echo -e "${GREEN}✅ Deployment Summary:${NC}"
echo "=============================================="
echo "✓ Database migration: pushToken column (will be added on server start)"
echo "✓ Backend deployed to: $BACKEND_SERVICE"
echo "✓ Backend URL: $BACKEND_URL"
if [ -n "$ADMIN_URL" ]; then
    echo "✓ Admin frontend deployed to: $ADMIN_FRONTEND_SERVICE"
    echo "✓ Admin frontend URL: $ADMIN_URL"
fi
if [ -n "$CUSTOMER_URL" ]; then
    echo "✓ Customer frontend deployed to: $CUSTOMER_FRONTEND_SERVICE"
    echo "✓ Customer frontend URL: $CUSTOMER_URL"
fi
echo "✓ CORS maintained (configured in backend/app.js)"
echo "✓ Android app: Build manually using instructions above"
echo ""
echo -e "${GREEN}🎉 Deployment to production completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify backend health: curl $BACKEND_URL/api/health"
if [ -n "$ADMIN_URL" ]; then
    echo "2. Test admin frontend: $ADMIN_URL"
fi
if [ -n "$CUSTOMER_URL" ]; then
    echo "3. Test customer frontend: $CUSTOMER_URL"
fi
echo "4. Build Android app if needed (see instructions above)"
echo "5. Test shop agent push notifications"
echo "6. Monitor production logs: gcloud run services logs read $BACKEND_SERVICE --region $REGION --project $PROJECT_ID"
echo ""
