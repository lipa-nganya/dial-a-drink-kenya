#!/bin/bash
# Deploy Frontend to Production (Cloud Run)
# This script deploys the customer frontend to Google Cloud Run production

set -e

# Load production configuration
if [ -f "production-config.env" ]; then
    source production-config.env
else
    echo "❌ Error: production-config.env not found"
    echo "   Please run ./setup-production.sh first"
    exit 1
fi

# Frontend-specific configuration
FRONTEND_SERVICE_NAME="deliveryos-customer-frontend"
PRODUCTION_BACKEND_URL="https://deliveryos-production-backend-805803410802.us-central1.run.app/api"

echo "🚀 Deploying Customer Frontend to Production (Cloud Run)"
echo "========================================================"
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $FRONTEND_SERVICE_NAME"
echo "   Backend API: $PRODUCTION_BACKEND_URL"
echo ""

# Set project
gcloud config set project "$PROJECT_ID"

# Build and deploy using cloudbuild.yaml
echo "🔨 Building and deploying Docker image..."
cd frontend

# cloudbuild.yaml already handles building, pushing, and deploying to Cloud Run
# Generate a short SHA from timestamp for image tagging
SHORT_SHA=$(date +%s | sha256sum | head -c 8)

gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA \
    --project "$PROJECT_ID" \
    . || {
    echo "❌ Build and deployment failed"
    exit 1
}

# Get service URL
echo ""
echo "📡 Getting service URL..."
SERVICE_URL=$(gcloud run services describe "$FRONTEND_SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📝 Next Steps:"
echo "   1. Map custom domain 'ruakadrinksdelivery.co.ke' to this service:"
echo "      gcloud run domain-mappings create \\"
echo "        --service $FRONTEND_SERVICE_NAME \\"
echo "        --domain ruakadrinksdelivery.co.ke \\"
echo "        --domain www.ruakadrinksdelivery.co.ke \\"
echo "        --region $REGION \\"
echo "        --project $PROJECT_ID"
echo ""
echo "   2. Update DNS records to point to Cloud Run:"
echo "      - Add CNAME record: www -> ghs.googlehosted.com"
echo "      - Add A record: @ -> (IPs from domain mapping)"
echo "      See DNS_CONFIGURATION.md for details"
echo ""
echo "   3. Test the deployed frontend:"
echo "      curl $SERVICE_URL"
echo ""
