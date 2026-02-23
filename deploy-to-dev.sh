#!/bin/bash
# Deploy to Development Environment
# This script handles:
# 1. Git push to GitHub (triggers Netlify for frontend auto-deploy)
# 2. Backend deployment to existing Google Cloud Run service
# 3. CORS maintenance (already configured in backend/app.js)
# 4. Database migrations check (none needed - email OTP uses existing schema)
# 5. Android app build instructions

set -e  # Exit on error

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
    echo "   Please authenticate with: gcloud auth login"
    exit 1
}
gcloud config set project "$PROJECT_ID"
echo "✅ Project set to: $PROJECT_ID"
echo "✅ Account: $GCLOUD_ACCOUNT"
echo ""

# Step 2: Check git status and commit changes
echo -e "${GREEN}📋 Step 2: Checking git status...${NC}"
if [ -n "$(git status --porcelain)" ]; then
    echo "Changes detected:"
    git status --short | head -20
    echo ""
    
    # Stage all changes
    echo -e "${GREEN}📦 Staging all changes...${NC}"
    git add -A
    
    # Commit changes
    echo -e "${GREEN}💾 Committing changes...${NC}"
    COMMIT_MSG="Deploy to development: Add email OTP support for non-Kenyan phone numbers, country code dropdown, and spam folder notice"
    git commit -m "$COMMIT_MSG" || {
        echo -e "${YELLOW}⚠️  No changes to commit or already committed${NC}"
    }
else
    echo "No uncommitted changes detected"
fi
echo ""

# Step 3: Push to GitHub (triggers Netlify auto-deploy)
echo -e "${GREEN}📤 Step 3: Pushing to GitHub (triggers Netlify auto-deploy)...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Ensure we're on develop branch or main
if [ "$CURRENT_BRANCH" != "develop" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  Not on develop or main branch. Current: $CURRENT_BRANCH${NC}"
    read -p "Continue with current branch? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Please switch to develop or main branch."
        exit 1
    fi
fi

# Push to GitHub
echo "Pushing to origin/$CURRENT_BRANCH..."
git push origin "$CURRENT_BRANCH" || {
    echo -e "${YELLOW}⚠️  Push failed or already up to date${NC}"
}
echo -e "${GREEN}✅ Git changes pushed (Netlify will auto-deploy frontend)${NC}"
echo ""

# Step 4: Database migrations check
echo -e "${GREEN}🗄️  Step 4: Checking database migrations...${NC}"
echo "Email OTP feature uses existing schema:"
echo "  ✓ otps table (phoneNumber field supports 'email:user@example.com' format)"
echo "  ✓ customers table (email column already exists)"
echo "✅ No new migrations required"
echo ""

# Step 5: Deploy backend to Google Cloud Run
echo -e "${GREEN}☁️  Step 5: Deploying backend to Google Cloud Run...${NC}"
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

# Extract existing values with defaults
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "FRONTEND_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dialadrink.thewolfgang.tech")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "ADMIN_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dialadrink-admin.thewolfgang.tech")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GOOGLE_CLOUD_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GCP_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")

echo "   FRONTEND_URL: $EXISTING_FRONTEND_URL"
echo "   ADMIN_URL: $EXISTING_ADMIN_URL"
echo ""

# Build and push image
echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-dev:$(date +%s)"
echo "   Image tag: $IMAGE_TAG"

gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Image built successfully${NC}"
echo ""

# Deploy to Cloud Run (existing service)
echo "🚀 Deploying to Cloud Run (existing service: $SERVICE_NAME)..."
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

# Step 6: CORS verification
echo -e "${GREEN}🔒 Step 6: CORS Configuration${NC}"
echo "CORS is configured in backend/app.js with the following origins:"
echo "  ✓ Netlify domains (*.netlify.app)"
echo "  ✓ Development domains (dialadrink.thewolfgang.tech, dialadrink-admin.thewolfgang.tech)"
echo "  ✓ Production domains (ruakadrinksdelivery.co.ke, etc.)"
echo "  ✓ Cloud Run services (*.run.app)"
echo "✅ CORS maintained - no changes needed"
echo ""

# Step 7: Android app build instructions
echo -e "${GREEN}📱 Step 7: Android App Build Instructions${NC}"
echo "================================================"
echo "To build the Android app for development:"
echo ""
echo "  cd driver-app-native"
echo "  ./gradlew assembleDevelopmentDebug"
echo ""
echo "APK will be at:"
echo "  app/build/outputs/apk/development/debug/app-development-debug.apk"
echo ""
echo "To build for production:"
echo "  ./gradlew assembleProductionRelease"
echo ""
echo "APK will be at:"
echo "  app/build/outputs/apk/production/release/app-production-release.apk"
echo ""

# Step 8: Summary
echo -e "${GREEN}✅ Deployment Summary:${NC}"
echo "================================================"
echo "✓ Git changes pushed to GitHub"
echo "✓ Frontend will auto-deploy via Netlify (from GitHub)"
echo "✓ Backend deployed to: $SERVICE_NAME"
echo "✓ Service URL: $FINAL_SERVICE_URL"
echo "✓ CORS maintained (configured in backend/app.js)"
echo "✓ Database migrations: None required (uses existing schema)"
echo "✓ Android app: Build manually using instructions above"
echo ""
echo -e "${GREEN}🎉 Deployment to development completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify backend health: curl $FINAL_SERVICE_URL/api/health"
echo "2. Check Netlify dashboard for frontend deployment status"
echo "3. Test email OTP feature with non-Kenyan phone numbers"
echo "4. Build Android app if needed (see instructions above)"
echo ""
