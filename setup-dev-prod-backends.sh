#!/bin/bash
# Setup Development and Production Backend Services

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

# Development Database
DEV_DB_INSTANCE="dialadrink-db-dev"
DEV_DB_NAME="dialadrink_dev"
DEV_DB_USER="dialadrink_app"
DEV_DB_PASSWORD="o61yqm5fLiTwWnk5"
DEV_CONNECTION="dialadrink-production:us-central1:dialadrink-db-dev"

# Production Database
PROD_DB_INSTANCE="dialadrink-db-prod"
PROD_DB_NAME="dialadrink_prod"
PROD_DB_USER="dialadrink_app"
PROD_DB_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"

echo "🚀 Setting up Development and Production Backend Services"
echo "=========================================================="
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Build Docker image
echo "📦 Building Docker image..."
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/deliveryos-backend:latest .
cd ..

echo ""
echo "🔧 Deploying Development Backend..."
echo ""

# Deploy Development Backend
gcloud run deploy deliveryos-backend-dev \
  --image gcr.io/$PROJECT_ID/deliveryos-backend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances=$DEV_CONNECTION \
  --set-env-vars "NODE_ENV=development,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID" \
  --update-env-vars "DATABASE_URL=postgresql://${DEV_DB_USER}:${DEV_DB_PASSWORD}@/${DEV_DB_NAME}?host=/cloudsql/${DEV_CONNECTION}" \
  --update-env-vars "FRONTEND_URL=https://dialadrink.thewolfgang.tech,ADMIN_URL=https://dialadrink-admin.thewolfgang.tech" \
  --memory 512Mi \
  --timeout 300 \
  --project $PROJECT_ID

echo ""
echo "🔧 Deploying Production Backend..."
echo ""

# Deploy Production Backend
gcloud run deploy deliveryos-backend-prod \
  --image gcr.io/$PROJECT_ID/deliveryos-backend:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances=$PROD_CONNECTION \
  --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID" \
  --update-env-vars "DATABASE_URL=postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@/${PROD_DB_NAME}?host=/cloudsql/${PROD_CONNECTION}" \
  --update-env-vars "FRONTEND_URL=https://ruakadrinksdelivery.co.ke,ADMIN_URL=https://dial-a-drink-admin.netlify.app" \
  --memory 512Mi \
  --timeout 300 \
  --project $PROJECT_ID

echo ""
echo "✅ Backend services deployed!"
echo ""
echo "📋 Service URLs:"
gcloud run services list --region $REGION --format="table(metadata.name,status.url)" --project $PROJECT_ID

echo ""
echo "📝 Next Steps:"
echo "  1. Update frontend API configurations with new backend URLs"
echo "  2. Update driver app gradle.properties"
echo "  3. Update backend CORS for all frontend sites"
echo "  4. Run database migrations on both databases"
