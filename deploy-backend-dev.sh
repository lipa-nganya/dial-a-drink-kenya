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
# Always use 0.0.0.0 for Cloud Run - never use a URL
EXISTING_HOST="0.0.0.0"

# Get existing M-Pesa credentials or use sandbox defaults
EXISTING_MPESA_CONSUMER_KEY=$(echo "$EXISTING_ENV_RAW" | grep -o "MPESA_CONSUMER_KEY.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "")
EXISTING_MPESA_CONSUMER_SECRET=$(echo "$EXISTING_ENV_RAW" | grep -o "MPESA_CONSUMER_SECRET.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "")
EXISTING_MPESA_SHORTCODE=$(echo "$EXISTING_ENV_RAW" | grep -o "MPESA_SHORTCODE.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "")
EXISTING_MPESA_PASSKEY=$(echo "$EXISTING_ENV_RAW" | grep -o "MPESA_PASSKEY.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "")

# Use existing credentials if available, otherwise use sandbox defaults
if [ -z "$EXISTING_MPESA_CONSUMER_KEY" ]; then
  # M-Pesa Sandbox Credentials (Dev)
  MPESA_CONSUMER_KEY="FHZFIBqOrkVQRROotlEhiit3LWycwhsg2GgIxeS1BaE46Ecf"
  MPESA_CONSUMER_SECRET="BDosKnRkJOXzY2oIeAMp12g5mQHxjkPCA1k5drdUmrqsd2A9W3APkmgx5ThkLjws"
  MPESA_SHORTCODE="174379"
  MPESA_PASSKEY="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
  echo "   Using M-Pesa Sandbox credentials (default)"
else
  MPESA_CONSUMER_KEY="$EXISTING_MPESA_CONSUMER_KEY"
  MPESA_CONSUMER_SECRET="$EXISTING_MPESA_CONSUMER_SECRET"
  MPESA_SHORTCODE="$EXISTING_MPESA_SHORTCODE"
  MPESA_PASSKEY="$EXISTING_MPESA_PASSKEY"
  echo "   Preserving existing M-Pesa credentials"
fi

# Get existing PesaPal credentials or use sandbox defaults
EXISTING_PESAPAL_CONSUMER_KEY=$(echo "$EXISTING_ENV_RAW" | grep -o "PESAPAL_CONSUMER_KEY.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "")
EXISTING_PESAPAL_CONSUMER_SECRET=$(echo "$EXISTING_ENV_RAW" | grep -o "PESAPAL_CONSUMER_SECRET.*value': '[^']*" | sed "s/.*value': '\([^']*\).*/\1/" || echo "")

# Use existing credentials if available, otherwise use environment variables or sandbox defaults
if [ -z "$EXISTING_PESAPAL_CONSUMER_KEY" ]; then
  # Try to get from environment variables first
  if [ -n "$PESAPAL_CONSUMER_KEY" ] && [ -n "$PESAPAL_CONSUMER_SECRET" ]; then
    echo "   Using PesaPal credentials from environment variables"
  else
    # Fallback to sandbox defaults (WARNING: These should be in environment variables)
    echo "   ⚠️  WARNING: Using hardcoded sandbox credentials. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET environment variables for security."
    PESAPAL_CONSUMER_KEY="${PESAPAL_CONSUMER_KEY:-qkio1BGGYAXTu2JOfm7XSXNruoZsrqEW}"
    PESAPAL_CONSUMER_SECRET="${PESAPAL_CONSUMER_SECRET:-osGQ364R49cXKeOYSpaOnT++rHs=}"
  fi
else
  PESAPAL_CONSUMER_KEY="$EXISTING_PESAPAL_CONSUMER_KEY"
  PESAPAL_CONSUMER_SECRET="$EXISTING_PESAPAL_CONSUMER_SECRET"
  echo "   Preserving existing PesaPal credentials"
fi

# Get service URL for callback URLs
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "https://deliveryos-development-backend-lssctajjoq-uc.a.run.app")

# Payment credentials - sandbox for development
PESAPAL_ENVIRONMENT="sandbox"
MPESA_ENVIRONMENT="sandbox"
PESAPAL_IPN_CALLBACK_URL="${SERVICE_URL}/api/pesapal/ipn"
MPESA_CALLBACK_URL="${SERVICE_URL}/api/mpesa/callback"

# Google Maps API Key - use environment variable or fallback
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
  echo "   ⚠️  WARNING: GOOGLE_MAPS_API_KEY not set in environment. Using default. Set GOOGLE_MAPS_API_KEY environment variable for security."
  GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-AIzaSyBYs413EeQVcChjlgrOMFd7U2dy60xiirk}"
fi

echo "   Preserving: FRONTEND_URL=$EXISTING_FRONTEND_URL"
echo "   Preserving: ADMIN_URL=$EXISTING_ADMIN_URL"
echo "   Payment Environment: Sandbox"
echo "   PesaPal IPN Callback: $PESAPAL_IPN_CALLBACK_URL"
echo "   M-Pesa Callback: $MPESA_CALLBACK_URL"
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
    --set-env-vars "NODE_ENV=development,DATABASE_URL=$DATABASE_URL,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$EXISTING_GOOGLE_CLOUD_PROJECT,GCP_PROJECT=$EXISTING_GCP_PROJECT,HOST=0.0.0.0,PESAPAL_ENVIRONMENT=$PESAPAL_ENVIRONMENT,MPESA_ENVIRONMENT=$MPESA_ENVIRONMENT,PESAPAL_IPN_CALLBACK_URL=$PESAPAL_IPN_CALLBACK_URL,MPESA_CALLBACK_URL=$MPESA_CALLBACK_URL,MPESA_CONSUMER_KEY=$MPESA_CONSUMER_KEY,MPESA_CONSUMER_SECRET=$MPESA_CONSUMER_SECRET,MPESA_SHORTCODE=$MPESA_SHORTCODE,MPESA_PASSKEY=$MPESA_PASSKEY,PESAPAL_CONSUMER_KEY=$PESAPAL_CONSUMER_KEY,PESAPAL_CONSUMER_SECRET=$PESAPAL_CONSUMER_SECRET,GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY" \
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
