#!/bin/bash
# Deploy Backend to Development
# This script deploys the backend service to Google Cloud Run development

set -e

# Development configuration
PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
INSTANCE_NAME="dialadrink-db-dev"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"
DB_NAME="dialadrink_dev"
DB_USER="dialadrink_app"
DB_PASSWORD="o61yqm5fLiTwWnk5"
DATABASE_URL="postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev"

echo "🚀 Deploying Backend to Development"
echo "==================================="
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo "   Database: $INSTANCE_NAME"
echo ""

# Set project
gcloud config set project "$PROJECT_ID"

# Build and push image
echo "🔨 Building Docker image..."
cd backend
gcloud builds submit --tag gcr.io/$PROJECT_ID/deliveryos-backend-dev . || {
    echo "❌ Build failed"
    exit 1
}

# Get existing environment variables to preserve them
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "FRONTEND_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dialadrink.thewolfgang.tech")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -o "ADMIN_URL.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "https://dialadrink-admin.thewolfgang.tech")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GOOGLE_CLOUD_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_RAW" | grep -o "GCP_PROJECT.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "$PROJECT_ID")
EXISTING_HOST=$(echo "$EXISTING_ENV_RAW" | grep -o "HOST.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "0.0.0.0")

echo "   Preserving: FRONTEND_URL=$EXISTING_FRONTEND_URL"
echo "   Preserving: ADMIN_URL=$EXISTING_ADMIN_URL"
echo ""

# Deploy to Cloud Run
echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image gcr.io/$PROJECT_ID/deliveryos-backend-dev \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=development,DATABASE_URL=$DATABASE_URL,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$EXISTING_GOOGLE_CLOUD_PROJECT,GCP_PROJECT=$EXISTING_GCP_PROJECT,HOST=$EXISTING_HOST" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project "$PROJECT_ID" || {
    echo "❌ Deployment failed"
    exit 1
}

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

echo ""
echo "✅ Backend deployed successfully!"
echo ""
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📝 Next Steps:"
echo "   1. Test health endpoint:"
echo "      curl $SERVICE_URL/api/health"
echo ""
echo "   2. Update frontend API URLs to point to: $SERVICE_URL/api"
echo ""
