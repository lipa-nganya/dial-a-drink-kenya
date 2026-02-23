#!/bin/bash
# Simple deployment script for development (non-interactive)

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
GCLOUD_ACCOUNT="dialadrinkkenya254@gmail.com"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"

echo "🚀 Deploying to Development Environment"
echo "========================================"
echo ""

# Step 1: gcloud setup
echo "🔐 Step 1: Setting up gcloud..."
gcloud config set account "$GCLOUD_ACCOUNT" 2>&1 || echo "Account may need authentication"
gcloud config set project "$PROJECT_ID" 2>&1
echo "✅ Project: $PROJECT_ID"
echo ""

# Step 2: Git operations
echo "📋 Step 2: Git operations..."
cd /Users/maria/dial-a-drink

# Stage and commit
git add -A 2>&1
git commit -m "Deploy to development: Add shop agent push notifications, inventory check improvements, and bug fixes" 2>&1 || echo "No changes to commit"

# Switch to develop branch
git checkout develop 2>&1 || git checkout -b develop 2>&1

# Merge main if needed
git merge main --no-edit 2>&1 || echo "Merge completed or no merge needed"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin develop 2>&1 || echo "Push completed or already up to date"
echo "✅ Git operations completed"
echo ""

# Step 3: Deploy backend
echo "☁️  Step 3: Deploying backend to Cloud Run..."
cd backend

# Get existing env vars
EXISTING_FRONTEND_URL="https://dialadrink.thewolfgang.tech"
EXISTING_ADMIN_URL="https://dialadrink-admin.thewolfgang.tech"

# Build image
echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-dev:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . 2>&1

echo "✅ Image built: $IMAGE_TAG"
echo ""

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=development,DATABASE_URL=postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/$CONNECTION_NAME,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID,HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project "$PROJECT_ID" 2>&1

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>&1)

echo ""
echo "✅ Deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📝 Next steps:"
echo "1. Verify health: curl $SERVICE_URL/api/health"
echo "2. Check Netlify for frontend deployment"
echo "3. Build Android app: cd driver-app-native && ./gradlew assembleDevelopmentDebug"
echo ""
