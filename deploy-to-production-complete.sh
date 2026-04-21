#!/bin/bash
# Complete Production Deployment Script
# Deploys backend (image only), frontends, and builds Android productionDebug variant.
# Secrets (DATABASE_URL, MPesa, SMTP, maps, etc.) stay in GCP — not read or written by this script.

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

BACKEND_SERVICE="deliveryos-production-backend"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-production-backend"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"

# Public site URLs (display only in summary)
PROD_FRONTEND_URL="https://ruakadrinksdelivery.co.ke"
PROD_ADMIN_URL="https://admin.ruakadrinksdelivery.co.ke"

echo "🚀 Complete Production Deployment"
echo "=================================="
echo ""
echo "📋 Configuration:"
echo "   Account: dialadrinkkenya254@gmail.com"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Backend Service: $BACKEND_SERVICE"
echo "   Frontend URL: $PROD_FRONTEND_URL"
echo "   Admin URL: $PROD_ADMIN_URL"
echo ""

# Check and set GCloud account
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [ "$CURRENT_ACCOUNT" != "dialadrinkkenya254@gmail.com" ]; then
    echo "⚠️  Current GCloud account: $CURRENT_ACCOUNT"
    echo "📧 Switching to dialadrinkkenya254@gmail.com..."
    gcloud config set account dialadrinkkenya254@gmail.com || {
        echo "❌ Failed to switch account. Please authenticate:"
        echo "   gcloud auth login dialadrinkkenya254@gmail.com"
        exit 1
    }
fi

# Set project
gcloud config set project "$PROJECT_ID"

echo ""
echo "📦 Step 1: Deploying Backend to Production"
echo "==========================================="
echo ""

cd backend

echo "🔨 Building Docker image..."
IMAGE_TAG="${BACKEND_IMAGE}:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo "❌ Build failed"
    exit 1
}

echo "🚀 Deploying backend (image only — existing env vars and secrets unchanged in GCP)..."
gcloud run deploy "$BACKEND_SERVICE" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$PROD_CONNECTION" \
    --project "$PROJECT_ID" || {
    echo "❌ Backend deployment failed"
    exit 1
}

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

echo "✅ Backend deployed: $BACKEND_URL"
cd ..

echo ""
echo "🌐 Step 2: Deploying Customer Frontend to Cloud Run"
echo "==================================================="
echo ""

cd frontend

# Build and deploy customer frontend
echo "🔨 Building customer frontend..."
SHORT_SHA=$(date +%s | sha256sum | head -c 8)

gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA \
    --project "$PROJECT_ID" \
    . || {
    echo "❌ Customer frontend deployment failed"
    exit 1
}

CUSTOMER_URL=$(gcloud run services describe "deliveryos-customer-frontend" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Customer frontend deployed: $CUSTOMER_URL"
cd ..

echo ""
echo "🌐 Step 3: Deploying Admin Frontend to Cloud Run"
echo "================================================="
echo ""

cd admin-frontend

# Build and deploy admin frontend
echo "🔨 Building admin frontend..."
SHORT_SHA=$(date +%s | sha256sum | head -c 8)

gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA \
    --project "$PROJECT_ID" \
    . || {
    echo "❌ Admin frontend deployment failed"
    exit 1
}

ADMIN_URL=$(gcloud run services describe "deliveryos-admin-frontend" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Admin frontend deployed: $ADMIN_URL"
cd ..

echo ""

echo ""
echo "📱 Step 4: Building Android ProductionDebug Variant"
echo "==================================================="
echo ""

cd driver-app-native

# Check if gradle.properties exists
if [ ! -f "gradle.properties" ]; then
    echo "📝 Creating gradle.properties..."
    touch gradle.properties
fi

# Update production API URL in gradle.properties
if grep -q "PROD_API_BASE_URL" gradle.properties; then
    sed -i.bak "s|PROD_API_BASE_URL=.*|PROD_API_BASE_URL=${BACKEND_URL}/api|" gradle.properties
    echo "✅ Updated PROD_API_BASE_URL in gradle.properties"
else
    echo "" >> gradle.properties
    echo "# Production API URL" >> gradle.properties
    echo "PROD_API_BASE_URL=${BACKEND_URL}/api" >> gradle.properties
    echo "✅ Added PROD_API_BASE_URL to gradle.properties"
fi

# Make gradlew executable
if [ -f "gradlew" ]; then
    chmod +x gradlew
else
    echo "❌ Error: gradlew not found"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean || {
    echo "⚠️  Clean failed, continuing..."
}

# Build productionDebug variant
echo ""
echo "🔨 Building productionDebug variant..."
./gradlew assembleProductionDebug || {
    echo "❌ Build failed"
    exit 1
}

# Check if build succeeded
APK_PATH="app/build/outputs/apk/production/debug/app-production-debug.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo "✅ ProductionDebug APK built successfully!"
    echo ""
    echo "📦 APK Details:"
    echo "   Location: $APK_PATH"
    echo "   Size: $APK_SIZE"
    echo ""
else
    echo "❌ Error: APK file not found at expected location"
    exit 1
fi

cd ..

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Complete Production Deployment Finished!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "   ✅ Backend: $BACKEND_URL"
echo "   ✅ Customer Frontend: $CUSTOMER_URL"
echo "   ✅ Admin Frontend: $ADMIN_URL"
echo "   ✅ Public sites: $PROD_FRONTEND_URL, $PROD_ADMIN_URL"
echo "   ✅ Cloud Run env/secrets: unchanged (managed in GCP)"
echo "   ✅ Android productionDebug: $APK_PATH"
echo ""
echo "🌐 Production Sites:"
echo "   Customer: $PROD_FRONTEND_URL (Cloud Run: $CUSTOMER_URL)"
echo "   Admin: $PROD_ADMIN_URL (Cloud Run: $ADMIN_URL)"
echo ""
echo "📝 Next Steps:"
echo "   1. Test backend health: curl $BACKEND_URL/api/health"
echo "   2. Push to main branch to trigger Netlify deployments"
echo "   3. Test Android APK on a device"
echo ""
