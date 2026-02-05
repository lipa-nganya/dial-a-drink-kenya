#!/bin/bash
# Deploy Backend to Production
# This script deploys the backend service to Google Cloud Run production

set -e

# Load production configuration
if [ -f "production-config.env" ]; then
    source production-config.env
else
    echo "❌ Error: production-config.env not found"
    echo "   Please run ./setup-production.sh first"
    exit 1
fi

echo "🚀 Deploying Backend to Production"
echo "=================================="
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
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME . || {
    echo "❌ Build failed"
    exit 1
}

# Deploy to Cloud Run
echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=production" \
    --set-env-vars "DATABASE_URL=$DATABASE_URL" \
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
echo "   1. Update environment variables with production secrets:"
echo "      gcloud run services update $SERVICE_NAME \\"
echo "        --region $REGION \\"
echo "        --update-env-vars PESAPAL_CONSUMER_KEY=... \\"
echo "        --update-env-vars PESAPAL_CONSUMER_SECRET=... \\"
echo "        --update-env-vars PESAPAL_ENVIRONMENT=live"
echo ""
echo "   2. Test health endpoint:"
echo "      curl $SERVICE_URL/api/health"
echo ""
echo "   3. Update frontend API URLs to point to: $SERVICE_URL/api"
