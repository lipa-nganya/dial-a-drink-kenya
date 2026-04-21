#!/bin/bash
# Deploy Backend to Development — rolls a new container image only.
# DATABASE_URL, MPesa/PesaPal sandbox keys, SMTP, maps, etc. remain as configured on the service.

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"

echo "🚀 Deploying Backend to Development"
echo "==================================="
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo ""

gcloud config set project "$PROJECT_ID"

cd backend

echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-dev:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo "❌ Build failed"
    exit 1
}

echo ""
echo "🚀 Deploying to Cloud Run (preserves existing env/secrets)..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --project "$PROJECT_ID" || {
    echo "❌ Deployment failed"
    exit 1
}

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

cd ..

echo ""
echo "✅ Backend deployed successfully!"
echo ""
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📝 Next steps:"
echo "   curl $SERVICE_URL/api/health"
echo ""
