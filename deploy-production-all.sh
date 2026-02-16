#!/bin/bash
# Deploy All to Production
# 1. Database migration (local to production)
# 2. Backend to production
# 3. Customer frontend to production
# 4. Admin frontend to production

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

# Production Backend
BACKEND_SERVICE="deliveryos-production-backend"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-backend"
PROD_DB_INSTANCE="dialadrink-db-prod"
PROD_DB_NAME="dialadrink_prod"
PROD_DB_USER="dialadrink_app"
PROD_DB_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"
PROD_DATABASE_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@/${PROD_DB_NAME}?host=/cloudsql/${PROD_CONNECTION}"

# Production Frontend Services
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

# Check GCloud account
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
echo "📊 Step 1: Database Migration (Local to Production)"
echo "==================================================="
echo ""
read -p "⚠️  This will replace all inventory data in production. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Database migration cancelled"
    exit 1
fi

cd backend
chmod +x scripts/copy-inventory-to-prod.sh
./scripts/copy-inventory-to-prod.sh || {
    echo "❌ Database migration failed"
    exit 1
}
cd ..

echo ""
echo "📦 Step 2: Deploying Backend to Production"
echo "=========================================="
echo ""

cd backend

# Build Docker image
echo "🔨 Building Docker image..."
gcloud builds submit --tag "${BACKEND_IMAGE}:latest" . || {
    echo "❌ Build failed"
    exit 1
}

# Get existing environment variables
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_YAML=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract existing env vars (preserve secrets)
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: FRONTEND_URL" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "https://ruakadrinksdelivery.co.ke")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: ADMIN_URL" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "https://admin.ruakadrinksdelivery.co.ke")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: GOOGLE_CLOUD_PROJECT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: GCP_PROJECT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "$PROJECT_ID")
EXISTING_HOST=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: HOST" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "0.0.0.0")

# Deploy backend
echo "🚀 Deploying backend..."
gcloud run deploy "$BACKEND_SERVICE" \
    --image "${BACKEND_IMAGE}:latest" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$PROD_CONNECTION" \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=$PROD_DATABASE_URL,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$EXISTING_GOOGLE_CLOUD_PROJECT,GCP_PROJECT=$EXISTING_GCP_PROJECT,HOST=$EXISTING_HOST" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
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
echo "🌐 Step 3: Deploying Customer Frontend"
echo "======================================="
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

CUSTOMER_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Customer frontend deployed: $CUSTOMER_URL"
cd ..

echo ""
echo "🌐 Step 4: Deploying Admin Frontend"
echo "===================================="
echo ""

cd admin-frontend

# Check if cloudbuild.yaml exists, if not create one
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
      - '--memory'
      - '256Mi'
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
