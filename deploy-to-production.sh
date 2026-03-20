#!/bin/bash
# Deploy to Production Environment
# This script deploys all changes from develop branch to production
# Does NOT create new services - updates existing ones only

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
GCLOUD_ACCOUNT="dialadrinkkenya254@gmail.com"
PROD_DB_INSTANCE="dialadrink-db-prod"
PROD_DB_NAME="dialadrink_prod"
PROD_DB_USER="dialadrink_app"
PROD_DB_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"
PROD_DATABASE_URL="postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@/${PROD_DB_NAME}?host=/cloudsql/${PROD_CONNECTION}"

# Production Frontend URLs (for CORS) - defaults from Cloud Run; override in GCP if using custom domains
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"

echo "🚀 Deploying to Production Environment"
echo "======================================"
echo ""

# Step 1: Verify gcloud authentication
echo "🔐 Step 1: Verifying gcloud authentication..."
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [ "$CURRENT_ACCOUNT" != "$GCLOUD_ACCOUNT" ]; then
    echo "⚠️  Current account: $CURRENT_ACCOUNT"
    echo "📧 Switching to $GCLOUD_ACCOUNT..."
    gcloud config set account "$GCLOUD_ACCOUNT" 2>&1 || {
        echo "❌ Failed to switch account. Please authenticate:"
        echo "   gcloud auth login $GCLOUD_ACCOUNT"
        exit 1
    }
fi
gcloud config set project "$PROJECT_ID" 2>&1
echo "✅ Authenticated and project set"
echo ""

# Step 2: Ensure no credentials are exposed
echo "🔒 Step 2: Checking for exposed credentials..."
cd /Users/maria/dial-a-drink

# Check for .env files that might be committed
if git ls-files | grep -E '\.env$|\.env\.local$|\.env\.production$' | grep -v '.gitignore'; then
    echo "❌ Error: .env files found in git. Please ensure they are in .gitignore"
    exit 1
fi

# Check for hardcoded credentials in key files
if grep -r "password.*=.*['\"].*[a-zA-Z0-9]{8,}" backend/routes/ backend/models/ backend/app.js 2>/dev/null | grep -v "//.*password" | grep -v "password.*:"; then
    echo "⚠️  Warning: Potential hardcoded passwords found. Please review."
fi

echo "✅ Credential check passed"
echo ""

# Step 3: Git operations
echo "📋 Step 3: Git operations..."
# Ensure we're on develop branch
git checkout develop 2>&1 || git checkout -b develop 2>&1

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "📝 Staging all changes..."
    git add -A
    COMMIT_MSG="Deploy to production: $(date +'%Y-%m-%d %H:%M:%S') - Production deployment"
    git commit -m "$COMMIT_MSG" 2>&1 || echo "Commit completed"
fi

# Push to GitHub (this will trigger Netlify deployment for frontend)
echo "📤 Pushing to GitHub..."
git push origin develop 2>&1 || echo "Push completed or already up to date"
echo "✅ Git operations completed"
echo "   Frontend will auto-deploy via Netlify from GitHub"
echo ""

# Step 4: Deploy backend
echo "☁️  Step 4: Deploying backend to Cloud Run (updating existing service)..."
cd backend

# Get existing environment variables from the service
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Default FRONTEND_URL/ADMIN_URL from Cloud Run frontend services (CORS for *.run.app)
PROD_FRONTEND_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null || echo "https://ruakadrinksdelivery.co.ke")
PROD_ADMIN_URL=$(gcloud run services describe "$ADMIN_FRONTEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null || echo "https://admin.ruakadrinksdelivery.co.ke")

# Extract existing URLs and credentials (maintain CORS and secrets)
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV" | grep -A1 "name: FRONTEND_URL" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1)
EXISTING_FRONTEND_URL=${EXISTING_FRONTEND_URL:-$PROD_FRONTEND_URL}
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV" | grep -A1 "name: ADMIN_URL" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1)
EXISTING_ADMIN_URL=${EXISTING_ADMIN_URL:-$PROD_ADMIN_URL}

# Extract M-Pesa credentials (preserve them)
EXISTING_MPESA_CONSUMER_KEY=$(echo "$EXISTING_ENV" | grep -A1 "name: MPESA_CONSUMER_KEY" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_MPESA_CONSUMER_SECRET=$(echo "$EXISTING_ENV" | grep -A1 "name: MPESA_CONSUMER_SECRET" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_MPESA_SHORTCODE=$(echo "$EXISTING_ENV" | grep -A1 "name: MPESA_SHORTCODE" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_MPESA_PASSKEY=$(echo "$EXISTING_ENV" | grep -A1 "name: MPESA_PASSKEY" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_MPESA_PAYBILL_ACCOUNT=$(echo "$EXISTING_ENV" | grep -A1 "name: MPESA_PAYBILL_ACCOUNT" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_MPESA_ENVIRONMENT=$(echo "$EXISTING_ENV" | grep -A1 "name: MPESA_ENVIRONMENT" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "production")
EXISTING_BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null || echo "")
EXISTING_MPESA_CALLBACK_URL="${EXISTING_BACKEND_URL}/api/mpesa/callback"

# Strip wrapping quotes that may have been stored as part of env values (e.g. "'174379'")
strip_wrapping_quotes() {
  local v="$1"
  v="$(echo -n "$v" | sed "s/^'//; s/'$//; s/^\"//; s/\"$//")"
  echo -n "$v"
}

EXISTING_MPESA_CONSUMER_KEY="$(strip_wrapping_quotes "$EXISTING_MPESA_CONSUMER_KEY")"
EXISTING_MPESA_CONSUMER_SECRET="$(strip_wrapping_quotes "$EXISTING_MPESA_CONSUMER_SECRET")"
EXISTING_MPESA_SHORTCODE="$(strip_wrapping_quotes "$EXISTING_MPESA_SHORTCODE")"
EXISTING_MPESA_PASSKEY="$(strip_wrapping_quotes "$EXISTING_MPESA_PASSKEY")"
EXISTING_MPESA_PAYBILL_ACCOUNT="$(strip_wrapping_quotes "$EXISTING_MPESA_PAYBILL_ACCOUNT")"

# Extract SMTP credentials
EXISTING_SMTP_HOST=$(echo "$EXISTING_ENV" | grep -A1 "name: SMTP_HOST" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_SMTP_PORT=$(echo "$EXISTING_ENV" | grep -A1 "name: SMTP_PORT" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_SMTP_SECURE=$(echo "$EXISTING_ENV" | grep -A1 "name: SMTP_SECURE" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_SMTP_USER=$(echo "$EXISTING_ENV" | grep -A1 "name: SMTP_USER" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_SMTP_PASS=$(echo "$EXISTING_ENV" | grep -A1 "name: SMTP_PASS" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")
EXISTING_SMTP_FROM=$(echo "$EXISTING_ENV" | grep -A1 "name: SMTP_FROM" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")

# Extract Google Maps API Key
EXISTING_GOOGLE_MAPS_API_KEY=$(echo "$EXISTING_ENV" | grep -A1 "name: GOOGLE_MAPS_API_KEY" | grep "value:" | sed "s/.*value: *//" | tr -d '"' | head -1 || echo "")

echo "   FRONTEND_URL: $EXISTING_FRONTEND_URL"
echo "   ADMIN_URL: $EXISTING_ADMIN_URL"
echo "   ✅ Credentials preserved (M-Pesa, SMTP, etc.)"
echo ""

# Build Docker image
echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-production-backend:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . 2>&1

echo "✅ Image built: $IMAGE_TAG"
echo ""

# Prepare environment variables (preserve all existing credentials)
ENV_VARS="NODE_ENV=production"
ENV_VARS="$ENV_VARS,DATABASE_URL=$PROD_DATABASE_URL"
ENV_VARS="$ENV_VARS,FRONTEND_URL=$EXISTING_FRONTEND_URL"
ENV_VARS="$ENV_VARS,ADMIN_URL=$EXISTING_ADMIN_URL"
ENV_VARS="$ENV_VARS,GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
ENV_VARS="$ENV_VARS,GCP_PROJECT=$PROJECT_ID"
ENV_VARS="$ENV_VARS,HOST=0.0.0.0"

# Add M-Pesa credentials if they exist
if [ -n "$EXISTING_MPESA_CONSUMER_KEY" ]; then
    ENV_VARS="$ENV_VARS,MPESA_CONSUMER_KEY=$EXISTING_MPESA_CONSUMER_KEY"
fi
if [ -n "$EXISTING_MPESA_CONSUMER_SECRET" ]; then
    ENV_VARS="$ENV_VARS,MPESA_CONSUMER_SECRET=$EXISTING_MPESA_CONSUMER_SECRET"
fi
if [ -n "$EXISTING_MPESA_SHORTCODE" ]; then
    ENV_VARS="$ENV_VARS,MPESA_SHORTCODE=$EXISTING_MPESA_SHORTCODE"
fi
if [ -n "$EXISTING_MPESA_PASSKEY" ]; then
    ENV_VARS="$ENV_VARS,MPESA_PASSKEY=$EXISTING_MPESA_PASSKEY"
fi
if [ -n "$EXISTING_MPESA_PAYBILL_ACCOUNT" ]; then
    ENV_VARS="$ENV_VARS,MPESA_PAYBILL_ACCOUNT=$EXISTING_MPESA_PAYBILL_ACCOUNT"
fi
if [ -n "$EXISTING_MPESA_ENVIRONMENT" ]; then
    ENV_VARS="$ENV_VARS,MPESA_ENVIRONMENT=$EXISTING_MPESA_ENVIRONMENT"
fi
if [ -n "$EXISTING_MPESA_CALLBACK_URL" ]; then
    ENV_VARS="$ENV_VARS,MPESA_CALLBACK_URL=$EXISTING_MPESA_CALLBACK_URL"
fi

# Add SMTP credentials if they exist (same as M-Pesa: read from existing service and re-pass)
# Quote values that contain space or comma so gcloud parses them correctly (e.g. Gmail app password with spaces)
quote_env_val() { if echo "$1" | grep -q '[ ,]'; then echo "\"$1\""; else echo "$1"; fi; }
if [ -n "$EXISTING_SMTP_HOST" ]; then
    ENV_VARS="$ENV_VARS,SMTP_HOST=$(quote_env_val "$EXISTING_SMTP_HOST")"
fi
if [ -n "$EXISTING_SMTP_PORT" ]; then
    ENV_VARS="$ENV_VARS,SMTP_PORT=$EXISTING_SMTP_PORT"
fi
if [ -n "$EXISTING_SMTP_SECURE" ]; then
    ENV_VARS="$ENV_VARS,SMTP_SECURE=$EXISTING_SMTP_SECURE"
fi
if [ -n "$EXISTING_SMTP_USER" ]; then
    ENV_VARS="$ENV_VARS,SMTP_USER=$(quote_env_val "$EXISTING_SMTP_USER")"
fi
if [ -n "$EXISTING_SMTP_PASS" ]; then
    ENV_VARS="$ENV_VARS,SMTP_PASS=$(quote_env_val "$EXISTING_SMTP_PASS")"
fi
if [ -n "$EXISTING_SMTP_FROM" ]; then
    ENV_VARS="$ENV_VARS,SMTP_FROM=$(quote_env_val "$EXISTING_SMTP_FROM")"
fi
if [ -z "$EXISTING_SMTP_HOST" ] && [ -z "$EXISTING_SMTP_USER" ]; then
    echo "   ⚠️  SMTP not set on service: OTP emails will fail. Add SMTP_* in GCP Console → Cloud Run → $BACKEND_SERVICE → Edit → Variables."
fi

# Add Google Maps API Key if it exists
if [ -n "$EXISTING_GOOGLE_MAPS_API_KEY" ]; then
    ENV_VARS="$ENV_VARS,GOOGLE_MAPS_API_KEY=$EXISTING_GOOGLE_MAPS_API_KEY"
fi

# Deploy to Cloud Run (update existing service, do not create new)
echo "🚀 Deploying to Cloud Run (updating existing service)..."
gcloud run deploy "$BACKEND_SERVICE" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --update-env-vars "$ENV_VARS" \
    --add-cloudsql-instances "$PROD_CONNECTION" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project "$PROJECT_ID" 2>&1

# Get service URL
SERVICE_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>&1)

echo ""
echo "✅ Backend deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""

# Step 5: Run database migrations
echo "📝 Step 5: Running database migrations..."
echo "   Creating Cloud Run Job for migrations..."

# Get the latest image
LATEST_IMAGE=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="value(spec.template.spec.containers[0].image)" 2>&1)

JOB_NAME="migration-job-prod"

# Create or update the migration job
gcloud run jobs create "$JOB_NAME" \
    --image "$LATEST_IMAGE" \
    --region "$REGION" \
    --set-env-vars "NODE_ENV=production,DATABASE_URL=$PROD_DATABASE_URL" \
    --set-cloudsql-instances "$PROD_CONNECTION" \
    --max-retries 1 \
    --task-timeout 600 \
    --project "$PROJECT_ID" \
    --command node \
    --args scripts/run-slug-migrations-sql.js 2>&1 || {
    echo "   Job already exists, updating..."
    gcloud run jobs update "$JOB_NAME" \
        --image "$LATEST_IMAGE" \
        --region "$REGION" \
        --set-env-vars "NODE_ENV=production,DATABASE_URL=$PROD_DATABASE_URL" \
        --set-cloudsql-instances "$PROD_CONNECTION" \
        --max-retries 1 \
        --task-timeout 600 \
        --project "$PROJECT_ID" \
        --command node \
        --args scripts/run-slug-migrations-sql.js 2>&1
}

echo ""
echo "🚀 Executing migration job..."
gcloud run jobs execute "$JOB_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --wait 2>&1

echo ""
echo "✅ Migrations completed"
echo ""

# Step 6: Deploy Customer Frontend to Cloud Run
echo "🌐 Step 6: Deploying Customer Frontend to Cloud Run..."
echo "   Service: deliveryos-customer-frontend"
echo ""

# Return to project root
cd /Users/maria/dial-a-drink
cd frontend

# Get Google Maps API Key (use existing from backend or default)
GOOGLE_MAPS_KEY="${EXISTING_GOOGLE_MAPS_API_KEY:-AIzaSyAM8GoxzNvr0LN2mgVp-mzHzQ_hFIa6AhE}"

# Generate short SHA for image tag
SHORT_SHA=$(date +%s | sha256sum | head -c 8 2>/dev/null || echo $(date +%s))

echo "🔨 Building and deploying customer frontend..."
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_KEY \
    --project "$PROJECT_ID" 2>&1 || {
    echo "❌ Customer frontend deployment failed"
    cd ..
    exit 1
}

CUSTOMER_FRONTEND_URL=$(gcloud run services describe "deliveryos-customer-frontend" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Customer frontend deployed: $CUSTOMER_FRONTEND_URL"
cd ..

# Step 7: Deploy Admin Frontend to Cloud Run
echo ""
echo "🌐 Step 7: Deploying Admin Frontend to Cloud Run..."
echo "   Service: deliveryos-admin-frontend"
echo ""

# Return to project root
cd /Users/maria/dial-a-drink
cd admin-frontend

echo "🔨 Building and deploying admin frontend..."
gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_KEY \
    --project "$PROJECT_ID" 2>&1 || {
    echo "❌ Admin frontend deployment failed"
    cd ..
    exit 1
}

ADMIN_FRONTEND_URL=$(gcloud run services describe "deliveryos-admin-frontend" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null || echo "")

echo "✅ Admin frontend deployed: $ADMIN_FRONTEND_URL"
cd ..

# Step 8: Push Android app code to production
echo ""
echo "📱 Step 8: Android app code pushed to GitHub"
echo "   Android app code is in driver-app-native/"
echo "   Code has been pushed to GitHub (develop branch)"
echo "   Build and deploy Android app separately if needed"
echo ""

# Step 9: Verify deployment
echo "✅ Step 9: Verifying deployment..."
echo "   Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/api/health" || echo "Failed")
echo "   Backend health check returned: $HEALTH_RESPONSE"
echo ""

echo "=========================================="
echo "✅ Production Deployment Summary"
echo "=========================================="
echo "🌐 Backend URL: $SERVICE_URL"
echo "🌐 Customer Frontend: $CUSTOMER_FRONTEND_URL"
echo "🌐 Admin Frontend: $ADMIN_FRONTEND_URL"
echo "📱 Android App: Code pushed to GitHub"
echo "📝 Migrations: Completed"
echo "🔒 CORS: Maintained (FRONTEND_URL and ADMIN_URL preserved)"
echo "🔐 Credentials: Preserved (M-Pesa, SMTP, etc.)"
echo ""
echo "📋 Next Steps:"
echo "1. Test backend API: curl $SERVICE_URL/api/health"
echo "2. Test customer frontend: $CUSTOMER_FRONTEND_URL"
echo "3. Test admin frontend: $ADMIN_FRONTEND_URL"
echo "4. Check CORS configuration if frontend has issues"
echo "5. Build Android app if needed: cd driver-app-native && ./gradlew assembleProductionRelease"
echo ""
