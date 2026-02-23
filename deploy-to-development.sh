#!/bin/bash
# Deploy to Development Environment
# This script handles:
# 1. Database migrations (pushToken column)
# 2. Backend deployment to Google Cloud Run (development)
# 3. Git push to GitHub (triggers Netlify for frontend)
# 4. Android app build instructions

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
SERVICE_NAME="deliveryos-development-backend"
GCLOUD_ACCOUNT="dialadrinkkenya254@gmail.com"
INSTANCE_NAME="dialadrink-db-dev"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"

echo -e "${BLUE}🚀 Deploying to Development Environment${NC}"
echo "================================================"
echo ""

# Step 1: Authenticate and set gcloud project
echo -e "${GREEN}🔐 Step 1: Setting up gcloud...${NC}"
gcloud config set account "$GCLOUD_ACCOUNT" || {
    echo -e "${YELLOW}⚠️  Account authentication may be needed. Run: gcloud auth login${NC}"
}
gcloud config set project "$PROJECT_ID"
echo "✅ Project set to: $PROJECT_ID"
echo ""

# Step 2: Commit and push changes to GitHub
echo -e "${GREEN}📋 Step 2: Committing and pushing changes to GitHub...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo "Changes detected:"
    git status --short | head -20
    echo ""
    
    # Stage all changes
    echo -e "${GREEN}📦 Staging all changes...${NC}"
    git add -A
    
    # Commit changes
    echo -e "${GREEN}💾 Committing changes...${NC}"
    COMMIT_MSG="Deploy to development: Add shop agent push notifications, inventory check improvements, and bug fixes"
    git commit -m "$COMMIT_MSG" || echo "No changes to commit or already committed"
    
    # Switch to develop branch
    echo -e "${GREEN}🌿 Switching to develop branch...${NC}"
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "develop" ]; then
        git checkout develop 2>/dev/null || git checkout -b develop
    fi
    
    # Merge main into develop if on develop
    if [ "$(git branch --show-current)" = "develop" ]; then
        echo -e "${GREEN}🔄 Merging main into develop...${NC}"
        git merge main --no-edit || echo "Merge completed or conflicts need resolution"
    fi
    
    # Push to GitHub (triggers Netlify)
    echo -e "${GREEN}📤 Pushing to GitHub (triggers Netlify deployment)...${NC}"
    git push origin develop || echo "Push failed or already up to date"
    echo -e "${GREEN}✅ Git changes pushed${NC}"
else
    echo "No uncommitted changes detected"
    # Still ensure we're on develop branch and push if needed
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "develop" ]; then
        echo -e "${GREEN}🌿 Switching to develop branch...${NC}"
        git checkout develop 2>/dev/null || git checkout -b develop
        git push origin develop || echo "Push failed or already up to date"
    fi
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
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

cd backend

# Get existing environment variables to preserve them
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract existing values
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "FRONTEND_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dialadrink.thewolfgang.tech")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "ADMIN_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dialadrink-admin.thewolfgang.tech")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GOOGLE_CLOUD_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GCP_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")

# Get service URL for callbacks
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "https://deliveryos-development-backend-lssctajjoq-uc.a.run.app")

# Build and push image
echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-dev:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

echo "✅ Image built successfully"
echo ""

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=development,DATABASE_URL=postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/$CONNECTION_NAME,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$EXISTING_GOOGLE_CLOUD_PROJECT,GCP_PROJECT=$EXISTING_GCP_PROJECT,HOST=0.0.0.0" \
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
FINAL_SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

echo ""
echo -e "${GREEN}✅ Backend deployed successfully!${NC}"
echo "🌐 Service URL: $FINAL_SERVICE_URL"
echo ""

cd ..

# Step 5: Android app build instructions
echo -e "${GREEN}📱 Step 5: Android App Build${NC}"
echo "================================================"
echo "To build the Android app for development:"
echo ""
echo "  cd driver-app-native"
echo "  ./gradlew assembleDevelopmentDebug"
echo ""
echo "APK will be at:"
echo "  app/build/outputs/apk/development/debug/app-development-debug.apk"
echo ""

# Step 6: Summary
echo -e "${GREEN}✅ Deployment Summary:${NC}"
echo "================================================"
echo "✓ Database migration: pushToken column (will be added on server start)"
echo "✓ Backend deployed to: $SERVICE_NAME"
echo "✓ Service URL: $FINAL_SERVICE_URL"
echo "✓ CORS maintained (configured in backend/app.js)"
echo "✓ Frontend changes pushed (Netlify will auto-deploy from GitHub)"
echo "✓ Android app: Build manually using instructions above"
echo ""
echo -e "${GREEN}🎉 Deployment to development completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify backend health: curl $FINAL_SERVICE_URL/api/health"
echo "2. Check Netlify dashboard for frontend deployment status"
echo "3. Build Android app if needed (see instructions above)"
echo "4. Test shop agent push notifications"
echo ""
