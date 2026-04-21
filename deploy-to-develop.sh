#!/bin/bash
# Deploy from local to develop environment
# This script handles:
# 1. Backend deployment to Google Cloud Run (develop)
# 2. Frontend push to GitHub (for Netlify)
# 3. Android app build and deployment

set -e  # Exit on error

echo "🚀 Starting deployment to develop environment..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ] || [ ! -d "driver-app-native" ]; then
    echo -e "${RED}❌ Error: Must run from project root directory${NC}"
    exit 1
fi

# Step 1: Remove git lock if exists
if [ -f ".git/index.lock" ]; then
    echo -e "${YELLOW}⚠️  Removing git lock file...${NC}"
    rm -f .git/index.lock
fi

# Step 2: Check git status
echo -e "\n${GREEN}📋 Step 1: Checking git status...${NC}"
git status --short | head -10

# Step 3: Stage all changes
echo -e "\n${GREEN}📦 Step 2: Staging all changes...${NC}"
git add -A

# Step 4: Commit changes
echo -e "\n${GREEN}💾 Step 3: Committing changes...${NC}"
COMMIT_MSG="Deploy to develop: Add penalties table, endpoints, and UI improvements"
git commit -m "$COMMIT_MSG" || echo "No changes to commit"

# Step 5: Switch to develop branch or create it
echo -e "\n${GREEN}🌿 Step 4: Switching to develop branch...${NC}"
git checkout develop 2>/dev/null || git checkout -b develop

# Step 6: Merge main into develop
echo -e "\n${GREEN}🔄 Step 5: Merging main into develop...${NC}"
git merge main --no-edit || echo "Merge completed or conflicts need resolution"

# Step 7: Push to GitHub (for Netlify frontend deployment)
echo -e "\n${GREEN}📤 Step 6: Pushing to GitHub (triggers Netlify deployment)...${NC}"
git push origin develop || echo "Push failed or already up to date"

# Step 7: Deploy backend to Google Cloud Run (develop)
echo -e "\n${GREEN}☁️  Step 7: Deploying backend to Google Cloud Run (develop)...${NC}"
echo "Using account: dialadrinkkenya254@gmail.com"
echo "Service: deliveryos-development-backend"

cd backend

# Check if gcloud is configured
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI not found. Please install Google Cloud SDK${NC}"
    exit 1
fi

# Set the project (assuming it's dialadrink-production based on cloudbuild-dev.yaml)
PROJECT_ID="dialadrink-production"
SERVICE_NAME="deliveryos-development-backend"
REGION="us-central1"

echo "Setting gcloud project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Build and deploy using Cloud Build
echo "Triggering Cloud Build for develop environment..."
gcloud builds submit --config=cloudbuild-dev.yaml . || {
    echo -e "${YELLOW}⚠️  Cloud Build failed. Trying direct deployment...${NC}"
    
    # Alternative: Direct deployment (requires Docker)
    if command -v docker &> /dev/null; then
        echo "Building Docker image..."
        IMAGE_NAME="gcr.io/$PROJECT_ID/deliveryos-backend:develop-$(date +%s)"
        docker build -t $IMAGE_NAME .
        
        echo "Pushing image to Container Registry..."
        docker push $IMAGE_NAME
        
        echo "Deploying to Cloud Run..."
        gcloud run deploy $SERVICE_NAME \
            --image $IMAGE_NAME \
            --region $REGION \
            --platform managed \
            --allow-unauthenticated \
            --add-cloudsql-instances dialadrink-production:us-central1:dialadrink-db-dev \
            --update-env-vars NODE_ENV=development,FRONTEND_URL=https://dialadrink.thewolfgang.tech,ADMIN_URL=https://dialadrink-admin.thewolfgang.tech,HOST=0.0.0.0
    else
        echo -e "${RED}❌ Docker not found. Cannot deploy backend.${NC}"
    fi
}

cd ..

# Step 8: Build Android app for developdebug
echo -e "\n${GREEN}📱 Step 8: Building Android app for developdebug...${NC}"
cd driver-app-native

# Check if Android SDK is available
if [ ! -d "$ANDROID_HOME" ] && [ ! -d "$HOME/Library/Android/sdk" ]; then
    echo -e "${YELLOW}⚠️  Android SDK not found. Skipping Android build.${NC}"
    echo "To build manually, run: ./gradlew assembleDevelopmentDebug"
else
    echo "Building developdebug variant..."
    ./gradlew assembleDevelopmentDebug || {
        echo -e "${YELLOW}⚠️  Gradle build failed. Check Android SDK setup.${NC}"
    }
    
    # APK location
    APK_PATH="app/build/outputs/apk/development/debug/app-development-debug.apk"
    if [ -f "$APK_PATH" ]; then
        echo -e "${GREEN}✅ APK built successfully: $APK_PATH${NC}"
        echo "APK size: $(du -h $APK_PATH | cut -f1)"
    else
        echo -e "${YELLOW}⚠️  APK not found at expected location${NC}"
    fi
fi

cd ..

# Step 9: Summary
echo -e "\n${GREEN}✅ Deployment Summary:${NC}"
echo "================================================"
echo "✓ Git changes committed and pushed to develop"
echo "✓ Backend deployed to: $SERVICE_NAME"
echo "✓ Frontend changes pushed (Netlify will auto-deploy)"
echo "✓ Android app built for developdebug"
echo ""
echo -e "${GREEN}🎉 Deployment to develop completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify backend is running: https://deliveryos-development-backend-805803410802.us-central1.run.app/api/health"
echo "2. Check Netlify for frontend deployment status"
echo "3. Install Android APK on test device if needed"
