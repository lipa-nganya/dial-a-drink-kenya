#!/bin/bash
# Deploy Backend to Production — rolls a new container image only.
# DATABASE_URL, MPesa, SMTP, and other secrets remain as configured on the Cloud Run service.

set -e

export CLOUDSDK_CORE_DISABLE_PROMPTS=1

if [ -f "production-config.env" ]; then
    # shellcheck disable=SC1091
    source production-config.env
else
    echo "❌ Error: production-config.env not found"
    echo "   Run ./setup-production.sh first (writes local connection details — keep out of git)"
    exit 1
fi

echo "🚀 Deploying Backend to Production"
echo "=================================="
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo ""

gcloud config set project "$PROJECT_ID"

cd backend

echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/$SERVICE_NAME:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . || {
    echo "❌ Build failed"
    exit 1
}

echo ""
echo "🚀 Deploying to Cloud Run (preserves existing env/secrets in GCP)..."
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
