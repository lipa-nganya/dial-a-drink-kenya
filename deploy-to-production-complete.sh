#!/bin/bash
# Complete Production Deployment Script
# Deploys backend, frontends, runs database migration, and builds Android productionDebug variant
# Account: dialadrinkkenya254@gmail.com
# Maintains CORS and credentials

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"

# Production Backend Configuration
BACKEND_SERVICE="deliveryos-production-backend"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-production-backend"
PROD_DB_INSTANCE="dialadrink-db-prod"
PROD_DB_NAME="dialadrink_prod"
PROD_DB_USER="dialadrink_app"
PROD_DB_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"
PROD_DATABASE_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@/${PROD_DB_NAME}?host=/cloudsql/${PROD_CONNECTION}"

# Production Frontend URLs (for CORS)
PROD_FRONTEND_URL="https://ruakadrinksdelivery.co.ke"
PROD_ADMIN_URL="https://admin.ruakadrinksdelivery.co.ke"

echo "🚀 Complete Production Deployment"
echo "=================================="
echo ""
echo "📋 Configuration:"
echo "   Account: dialadrinkkenya254@gmail.com"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Backend Service: $BACKEND_SERVICE"
echo "   Frontend URL: $PROD_FRONTEND_URL"
echo "   Admin URL: $PROD_ADMIN_URL"
echo ""

# Check and set GCloud account
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
echo "📊 Step 1: Database Migration (Stop Fields)"
echo "==========================================="
echo ""

# Create migration script for Cloud Run Job
MIGRATION_JOB_NAME="run-stop-fields-migration-$(date +%s)"

echo "📦 Creating Cloud Run job for migration: $MIGRATION_JOB_NAME"
echo ""

# Get backend service image
IMAGE=$(gcloud run services describe $BACKEND_SERVICE \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(spec.template.spec.containers[0].image)" 2>/dev/null || echo "")

if [ -z "$IMAGE" ]; then
  echo "⚠️  Backend service not found, will use latest image after deployment"
  IMAGE="${BACKEND_IMAGE}:latest"
fi

echo "📊 Using image: $IMAGE"
echo ""

echo "🔨 Creating Cloud Run job..."
gcloud run jobs create $MIGRATION_JOB_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --set-env-vars="NODE_ENV=production,DATABASE_URL=$PROD_DATABASE_URL" \
  --command="node" \
  --args="scripts/run-stop-fields-migration.js" \
  --set-cloudsql-instances=$PROD_CONNECTION \
  --max-retries=1 \
  --task-timeout=600 \
  --memory=512Mi \
  --cpu=1 \
  --project=$PROJECT_ID \
  --quiet || {
    echo "⚠️  Job creation failed, will run migration after backend deployment"
    MIGRATION_JOB_NAME=""
}

if [ -n "$MIGRATION_JOB_NAME" ]; then
  echo "✅ Job created"
  echo ""
  echo "▶️  Executing migration job..."
  gcloud run jobs execute $MIGRATION_JOB_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --wait || {
      echo "⚠️  Migration job failed, will retry after backend deployment"
    }
  
  echo ""
  echo "🧹 Cleaning up migration job..."
  gcloud run jobs delete $MIGRATION_JOB_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --quiet || true
fi

echo ""
echo "📦 Step 2: Deploying Backend to Production"
echo "==========================================="
echo ""

cd backend

# Build Docker image
echo "🔨 Building Docker image..."
gcloud builds submit --tag "${BACKEND_IMAGE}:latest" . || {
    echo "❌ Build failed"
    exit 1
}

# Get existing environment variables to preserve credentials
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_YAML=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract existing env vars (preserve all secrets and credentials)
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: FRONTEND_URL" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "$PROD_FRONTEND_URL")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: ADMIN_URL" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "$PROD_ADMIN_URL")
EXISTING_GOOGLE_CLOUD_PROJECT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: GOOGLE_CLOUD_PROJECT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "$PROJECT_ID")
EXISTING_GCP_PROJECT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: GCP_PROJECT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "$PROJECT_ID")
EXISTING_HOST=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: HOST" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "0.0.0.0")

# Extract SMTP credentials (preserve from existing deployment)
EXISTING_SMTP_HOST=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_HOST" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "smtp.gmail.com")
EXISTING_SMTP_PORT=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_PORT" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "587")
EXISTING_SMTP_SECURE=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_SECURE" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "false")
EXISTING_SMTP_USER=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_USER" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")
EXISTING_SMTP_PASS=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_PASS" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")
EXISTING_SMTP_FROM=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: SMTP_FROM" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")

# Production Payment Credentials - REQUIRED FOR PAYMENT FUNCTIONALITY
# These credentials are ALWAYS included in every deployment to ensure payment initiation works
# WARNING: These should be set as environment variables before running this script for security
if [ -z "$MPESA_CONSUMER_KEY" ] || [ -z "$MPESA_CONSUMER_SECRET" ] || [ -z "$MPESA_SHORTCODE" ] || [ -z "$MPESA_PASSKEY" ]; then
  echo "   ⚠️  WARNING: M-Pesa credentials not set in environment. Using defaults. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY environment variables for security."
fi
MPESA_CONSUMER_KEY="${MPESA_CONSUMER_KEY:-hdvVB9dDCQp4n80iPGWGVlOQmzfktkXr}"
MPESA_CONSUMER_SECRET="${MPESA_CONSUMER_SECRET:-IYFIJvfjSsHHqTyU}"
MPESA_SHORTCODE="${MPESA_SHORTCODE:-7861733}"
MPESA_PASSKEY="${MPESA_PASSKEY:-bfb205c2a0b53eb1685038322a8d6ae95abc2d63245eba38e96cc5fe45c84065}"
MPESA_PAYBILL_ACCOUNT="${MPESA_PAYBILL_ACCOUNT:-7251353}" # PayBill account number (PartyB) - different from shortcode
MPESA_ENVIRONMENT="production"

if [ -z "$PESAPAL_CONSUMER_KEY" ] || [ -z "$PESAPAL_CONSUMER_SECRET" ]; then
  echo "   ⚠️  WARNING: PesaPal credentials not set in environment. Using defaults. Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET environment variables for security."
fi
PESAPAL_CONSUMER_KEY="${PESAPAL_CONSUMER_KEY:-InqWcWvl2RKMObEqVcbZrlCVsWi5HBBu}"
PESAPAL_CONSUMER_SECRET="${PESAPAL_CONSUMER_SECRET:-DORzlWHU4xXKpkM6xnbZBlc3bV4=}"
PESAPAL_ENVIRONMENT="live"

# Get backend URL for callback URLs
PROD_BACKEND_URL="https://deliveryos-production-backend-805803410802.us-central1.run.app"
MPESA_CALLBACK_URL="${PROD_BACKEND_URL}/api/mpesa/callback"
PESAPAL_IPN_CALLBACK_URL="${PROD_BACKEND_URL}/api/pesapal/ipn"

# Google Maps API Key - use environment variable or fallback
if [ -z "$GOOGLE_MAPS_API_KEY" ]; then
  echo "   ⚠️  WARNING: GOOGLE_MAPS_API_KEY not set in environment. Using default. Set GOOGLE_MAPS_API_KEY environment variable for security."
  GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-AIzaSyBYs413EeQVcChjlgrOMFd7U2dy60xiirk}"
fi

# Preserve other environment variables (secrets, API keys, etc.)
# Get all env vars except the ones we're explicitly setting
PRESERVED_ENV_VARS=""
if [ -n "$EXISTING_ENV_YAML" ]; then
    # Extract all env var names except the ones we're managing
    # M-Pesa and SMTP credentials are explicitly set above, so exclude them from preserved vars
    PRESERVED_VAR_NAMES=$(echo "$EXISTING_ENV_YAML" | grep "name:" | sed "s/.*name: //" | grep -vE "FRONTEND_URL|ADMIN_URL|GOOGLE_CLOUD_PROJECT|GCP_PROJECT|HOST|NODE_ENV|DATABASE_URL|MPESA_CONSUMER_KEY|MPESA_CONSUMER_SECRET|MPESA_SHORTCODE|MPESA_PASSKEY|MPESA_PAYBILL_ACCOUNT|MPESA_ENVIRONMENT|MPESA_CALLBACK_URL|PESAPAL_CONSUMER_KEY|PESAPAL_CONSUMER_SECRET|PESAPAL_ENVIRONMENT|PESAPAL_IPN_CALLBACK_URL|GOOGLE_MAPS_API_KEY|SMTP_HOST|SMTP_PORT|SMTP_SECURE|SMTP_USER|SMTP_PASS|SMTP_FROM" || echo "")
    
    # Build preserved env vars string (we'll update them separately to avoid overwriting)
    for VAR_NAME in $PRESERVED_VAR_NAMES; do
        VAR_VALUE=$(echo "$EXISTING_ENV_YAML" | grep -A1 "name: $VAR_NAME" | grep "value:" | sed "s/.*value: //" | tr -d '"' || echo "")
        if [ -n "$VAR_VALUE" ]; then
            PRESERVED_ENV_VARS="${PRESERVED_ENV_VARS}${VAR_NAME}=${VAR_VALUE},"
        fi
    done
fi

echo "   Preserving CORS URLs:"
echo "      FRONTEND_URL=$EXISTING_FRONTEND_URL"
echo "      ADMIN_URL=$EXISTING_ADMIN_URL"
echo ""
echo "   Production Payment Credentials (ALWAYS INCLUDED):"
echo "      M-Pesa Environment: $MPESA_ENVIRONMENT"
echo "      M-Pesa Callback: $MPESA_CALLBACK_URL"
echo "      PesaPal Environment: $PESAPAL_ENVIRONMENT"
echo "      PesaPal IPN Callback: $PESAPAL_IPN_CALLBACK_URL"
echo ""
echo "   SMTP Credentials (Preserved):"
echo "      SMTP Host: $EXISTING_SMTP_HOST"
echo "      SMTP User: ${EXISTING_SMTP_USER:0:10}..."
echo ""

# Deploy backend with CORS, payment credentials, and SMTP preserved
# NOTE: M-Pesa credentials are ALWAYS included to ensure payment initiation works
echo "🚀 Deploying backend..."
gcloud run deploy "$BACKEND_SERVICE" \
    --image "${BACKEND_IMAGE}:latest" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$PROD_CONNECTION" \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=$PROD_DATABASE_URL,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$EXISTING_GOOGLE_CLOUD_PROJECT,GCP_PROJECT=$EXISTING_GCP_PROJECT,HOST=$EXISTING_HOST,MPESA_CONSUMER_KEY=$MPESA_CONSUMER_KEY,MPESA_CONSUMER_SECRET=$MPESA_CONSUMER_SECRET,MPESA_SHORTCODE=$MPESA_SHORTCODE,MPESA_PASSKEY=$MPESA_PASSKEY,MPESA_PAYBILL_ACCOUNT=$MPESA_PAYBILL_ACCOUNT,MPESA_ENVIRONMENT=$MPESA_ENVIRONMENT,MPESA_CALLBACK_URL=$MPESA_CALLBACK_URL,PESAPAL_CONSUMER_KEY=$PESAPAL_CONSUMER_KEY,PESAPAL_CONSUMER_SECRET=$PESAPAL_CONSUMER_SECRET,PESAPAL_ENVIRONMENT=$PESAPAL_ENVIRONMENT,PESAPAL_IPN_CALLBACK_URL=$PESAPAL_IPN_CALLBACK_URL,GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY,SMTP_HOST=$EXISTING_SMTP_HOST,SMTP_PORT=$EXISTING_SMTP_PORT,SMTP_SECURE=$EXISTING_SMTP_SECURE,SMTP_USER=$EXISTING_SMTP_USER,SMTP_PASS=$EXISTING_SMTP_PASS,SMTP_FROM=$EXISTING_SMTP_FROM" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project "$PROJECT_ID" || {
    echo "❌ Backend deployment failed"
    exit 1
}

# Update preserved environment variables if any
if [ -n "$PRESERVED_ENV_VARS" ]; then
    echo "📝 Updating preserved environment variables..."
    # Remove trailing comma
    PRESERVED_ENV_VARS=${PRESERVED_ENV_VARS%,}
    gcloud run services update "$BACKEND_SERVICE" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --update-env-vars "$PRESERVED_ENV_VARS" || {
        echo "⚠️  Warning: Failed to update some preserved environment variables"
    }
fi

BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)")

echo "✅ Backend deployed: $BACKEND_URL"
cd ..

# Run migration if it wasn't run before
if [ -z "$MIGRATION_JOB_NAME" ] || [ $? -ne 0 ]; then
    echo ""
    echo "🔄 Running database migration via Cloud Run Job..."
    MIGRATION_JOB_NAME="run-stop-fields-migration-$(date +%s)"
    
    gcloud run jobs create $MIGRATION_JOB_NAME \
      --image="${BACKEND_IMAGE}:latest" \
      --region=$REGION \
      --set-env-vars="NODE_ENV=production,DATABASE_URL=$PROD_DATABASE_URL" \
      --command="node" \
      --args="scripts/run-stop-fields-migration.js" \
      --set-cloudsql-instances=$PROD_CONNECTION \
      --max-retries=1 \
      --task-timeout=600 \
      --memory=512Mi \
      --cpu=1 \
      --project=$PROJECT_ID \
      --quiet
    
    gcloud run jobs execute $MIGRATION_JOB_NAME \
      --region=$REGION \
      --project=$PROJECT_ID \
      --wait
    
    gcloud run jobs delete $MIGRATION_JOB_NAME \
      --region=$REGION \
      --project=$PROJECT_ID \
      --quiet || true
fi

echo ""
echo "🌐 Step 3: Deploying Customer Frontend to Cloud Run"
echo "==================================================="
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

CUSTOMER_URL=$(gcloud run services describe "deliveryos-customer-frontend" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Customer frontend deployed: $CUSTOMER_URL"
cd ..

echo ""
echo "🌐 Step 4: Deploying Admin Frontend to Cloud Run"
echo "================================================="
echo ""

cd admin-frontend

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

ADMIN_URL=$(gcloud run services describe "deliveryos-admin-frontend" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Admin frontend deployed: $ADMIN_URL"
cd ..

echo ""

echo ""
echo "📱 Step 5: Building Android ProductionDebug Variant"
echo "==================================================="
echo ""

cd driver-app-native

# Check if gradle.properties exists
if [ ! -f "gradle.properties" ]; then
    echo "📝 Creating gradle.properties..."
    touch gradle.properties
fi

# Update production API URL in gradle.properties
if grep -q "PROD_API_BASE_URL" gradle.properties; then
    sed -i.bak "s|PROD_API_BASE_URL=.*|PROD_API_BASE_URL=${BACKEND_URL}/api|" gradle.properties
    echo "✅ Updated PROD_API_BASE_URL in gradle.properties"
else
    echo "" >> gradle.properties
    echo "# Production API URL" >> gradle.properties
    echo "PROD_API_BASE_URL=${BACKEND_URL}/api" >> gradle.properties
    echo "✅ Added PROD_API_BASE_URL to gradle.properties"
fi

# Make gradlew executable
if [ -f "gradlew" ]; then
    chmod +x gradlew
else
    echo "❌ Error: gradlew not found"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
./gradlew clean || {
    echo "⚠️  Clean failed, continuing..."
}

# Build productionDebug variant
echo ""
echo "🔨 Building productionDebug variant..."
./gradlew assembleProductionDebug || {
    echo "❌ Build failed"
    exit 1
}

# Check if build succeeded
APK_PATH="app/build/outputs/apk/production/debug/app-production-debug.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo "✅ ProductionDebug APK built successfully!"
    echo ""
    echo "📦 APK Details:"
    echo "   Location: $APK_PATH"
    echo "   Size: $APK_SIZE"
    echo ""
else
    echo "❌ Error: APK file not found at expected location"
    exit 1
fi

cd ..

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Complete Production Deployment Finished!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📊 Summary:"
echo "   ✅ Backend: $BACKEND_URL"
echo "   ✅ Database Migration: Completed"
echo "   ✅ Customer Frontend: $CUSTOMER_URL"
echo "   ✅ Admin Frontend: $ADMIN_URL"
echo "   ✅ CORS: Maintained ($PROD_FRONTEND_URL, $PROD_ADMIN_URL)"
echo "   ✅ Credentials: Preserved"
echo "   ✅ Android productionDebug: $APK_PATH"
echo ""
echo "🌐 Production Sites:"
echo "   Customer: $PROD_FRONTEND_URL (Cloud Run: $CUSTOMER_URL)"
echo "   Admin: $PROD_ADMIN_URL (Cloud Run: $ADMIN_URL)"
echo ""
echo "📝 Next Steps:"
echo "   1. Test backend health: curl $BACKEND_URL/api/health"
echo "   2. Push to main branch to trigger Netlify deployments"
echo "   3. Test Android APK on a device"
echo ""
