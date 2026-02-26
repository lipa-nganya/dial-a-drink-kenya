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

# Get existing environment variables to preserve credentials
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_YAML=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract existing credentials (preserve M-Pesa, SMTP, and other secrets)
EXISTING_MPESA_CONSUMER_KEY=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: MPESA_CONSUMER_KEY" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr")
EXISTING_MPESA_CONSUMER_SECRET=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: MPESA_CONSUMER_SECRET" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "IYFIJvfjSsHHqTyU")
EXISTING_MPESA_SHORTCODE=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: MPESA_SHORTCODE" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "7861733")
EXISTING_MPESA_PASSKEY=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: MPESA_PASSKEY" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "bfb205c2a0b53eb1685038322a8d6ae95abc2d63245eba38e96cc5fe45c84065")
EXISTING_MPESA_PAYBILL_ACCOUNT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: MPESA_PAYBILL_ACCOUNT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "7251353")
EXISTING_MPESA_ENVIRONMENT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: MPESA_ENVIRONMENT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "production")
EXISTING_BACKEND_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null || echo "https://deliveryos-production-backend-805803410802.us-central1.run.app")
EXISTING_MPESA_CALLBACK_URL="${EXISTING_BACKEND_URL}/api/mpesa/callback"

# Extract SMTP credentials
EXISTING_SMTP_HOST=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_HOST" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "smtp.gmail.com")
EXISTING_SMTP_PORT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_PORT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "587")
EXISTING_SMTP_SECURE=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_SECURE" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "false")
EXISTING_SMTP_USER=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_USER" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")
EXISTING_SMTP_PASS=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_PASS" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")
EXISTING_SMTP_FROM=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_FROM" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")

echo "   ✅ M-Pesa credentials preserved (REQUIRED for payment functionality)"
echo "   ✅ SMTP credentials preserved"

# Deploy to Cloud Run
# NOTE: M-Pesa credentials are ALWAYS included to ensure payment initiation works
echo ""
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=$DATABASE_URL,MPESA_CONSUMER_KEY=$EXISTING_MPESA_CONSUMER_KEY,MPESA_CONSUMER_SECRET=$EXISTING_MPESA_CONSUMER_SECRET,MPESA_SHORTCODE=$EXISTING_MPESA_SHORTCODE,MPESA_PASSKEY=$EXISTING_MPESA_PASSKEY,MPESA_PAYBILL_ACCOUNT=$EXISTING_MPESA_PAYBILL_ACCOUNT,MPESA_ENVIRONMENT=$EXISTING_MPESA_ENVIRONMENT,MPESA_CALLBACK_URL=$EXISTING_MPESA_CALLBACK_URL,SMTP_HOST=$EXISTING_SMTP_HOST,SMTP_PORT=$EXISTING_SMTP_PORT,SMTP_SECURE=$EXISTING_SMTP_SECURE,SMTP_USER=$EXISTING_SMTP_USER,SMTP_PASS=$EXISTING_SMTP_PASS,SMTP_FROM=$EXISTING_SMTP_FROM" \
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
echo "📝 Deployment Summary:"
echo "   ✅ M-Pesa credentials: Included (payment functionality enabled)"
echo "   ✅ SMTP credentials: Preserved"
echo "   ✅ Database connection: Configured"
echo ""
echo "📝 Next Steps:"
echo "   1. Test health endpoint:"
echo "      curl $SERVICE_URL/api/health"
echo ""
echo "   2. Test payment initiation (if needed):"
echo "      Verify M-Pesa credentials are working"
echo ""
echo "   3. Update frontend API URLs to point to: $SERVICE_URL/api"
