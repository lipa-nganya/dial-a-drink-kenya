#!/bin/bash
# Deploy backend + customer + admin frontends to production.
#
# Backend: new image only — DATABASE_URL, MPesa, SMTP, etc. remain as configured in GCP.
# Inventory sync from dev → prod is NOT run here; use backend/scripts/copy-inventory-to-prod.sh
# manually when needed (with credentials from your environment, never committed).

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

BACKEND_SERVICE="deliveryos-production-backend"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-production-backend"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"

CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"
PROD_BACKEND_URL="https://deliveryos-production-backend-805803410802.us-central1.run.app/api"

echo "🚀 Deploying All to Production"
echo "=============================="
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Backend Service: $BACKEND_SERVICE"
echo "   Customer Frontend: $CUSTOMER_FRONTEND_SERVICE"
echo "   Admin Frontend: $ADMIN_FRONTEND_SERVICE"
echo ""

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

gcloud config set project "$PROJECT_ID"

echo ""
echo "📦 Step 1: Deploying Backend to Production (image only)"
echo "======================================================="
echo ""

cd backend

echo "🔨 Building Docker image..."
IMAGE_TAG="${BACKEND_IMAGE}:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo "❌ Build failed"
    exit 1
}

echo "🚀 Deploying (preserves existing Cloud Run env/secrets)..."
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
echo "🌐 Step 2: Deploying Customer Frontend"
echo "======================================="
echo ""

cd frontend

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

CUSTOMER_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Customer frontend deployed: $CUSTOMER_URL"
cd ..

echo ""
echo "🌐 Step 3: Deploying Admin Frontend"
echo "===================================="
echo ""

cd admin-frontend

if [ ! -f "cloudbuild.yaml" ]; then
    echo "📝 Creating cloudbuild.yaml for admin frontend..."
    cat > cloudbuild.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:\$SHORT_SHA'
      - '-t'
      - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:latest'
      - '--build-arg'
      - 'REACT_APP_API_URL=$PROD_BACKEND_URL'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:\$SHORT_SHA'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:latest'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '$ADMIN_FRONTEND_SERVICE'
      - '--image'
      - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:\$SHORT_SHA'
      - '--region'
      - '$REGION'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'REACT_APP_API_URL=$PROD_BACKEND_URL'

images:
  - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:\$SHORT_SHA'
  - 'gcr.io/\$PROJECT_ID/dialadrink-admin-frontend:latest'

options:
  machineType: 'E2_HIGHCPU_8'
  logging: CLOUD_LOGGING_ONLY

timeout: '1200s'
EOF
fi

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

ADMIN_URL=$(gcloud run services describe "$ADMIN_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Admin frontend deployed: $ADMIN_URL"
cd ..

echo ""
echo "✅ All Production Deployments Complete!"
echo ""
echo "📊 Summary:"
echo "   Backend: $BACKEND_URL"
echo "   Customer Frontend: $CUSTOMER_URL"
echo "   Admin Frontend: $ADMIN_URL"
echo ""
echo "🌐 Production Sites:"
echo "   https://www.ruakadrinksdelivery.co.ke/"
echo "   https://admin.ruakadrinksdelivery.co.ke/login"
echo ""
