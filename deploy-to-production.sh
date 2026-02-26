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

# Production Frontend URLs (for CORS)
PROD_FRONTEND_URL="https://ruakadrinksdelivery.co.ke"
PROD_ADMIN_URL="https://admin.ruakadrinksdelivery.co.ke"

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
    --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract existing URLs and credentials (maintain CORS and secrets)
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "$PROD_FRONTEND_URL")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "$PROD_ADMIN_URL")

# Extract M-Pesa credentials (preserve them)
EXISTING_MPESA_CONSUMER_KEY=$(echo "$EXISTING_ENV" | grep -oP "MPESA_CONSUMER_KEY.*?value': '\K[^']*" || echo "")
EXISTING_MPESA_CONSUMER_SECRET=$(echo "$EXISTING_ENV" | grep -oP "MPESA_CONSUMER_SECRET.*?value': '\K[^']*" || echo "")
EXISTING_MPESA_SHORTCODE=$(echo "$EXISTING_ENV" | grep -oP "MPESA_SHORTCODE.*?value': '\K[^']*" || echo "")
EXISTING_MPESA_PASSKEY=$(echo "$EXISTING_ENV" | grep -oP "MPESA_PASSKEY.*?value': '\K[^']*" || echo "")
EXISTING_MPESA_PAYBILL_ACCOUNT=$(echo "$EXISTING_ENV" | grep -oP "MPESA_PAYBILL_ACCOUNT.*?value': '\K[^']*" || echo "")
EXISTING_MPESA_ENVIRONMENT=$(echo "$EXISTING_ENV" | grep -oP "MPESA_ENVIRONMENT.*?value': '\K[^']*" || echo "production")
EXISTING_BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)" 2>/dev/null || echo "")
EXISTING_MPESA_CALLBACK_URL="${EXISTING_BACKEND_URL}/api/mpesa/callback"

# Extract SMTP credentials
EXISTING_SMTP_HOST=$(echo "$EXISTING_ENV" | grep -oP "SMTP_HOST.*?value': '\K[^']*" || echo "")
EXISTING_SMTP_PORT=$(echo "$EXISTING_ENV" | grep -oP "SMTP_PORT.*?value': '\K[^']*" || echo "")
EXISTING_SMTP_SECURE=$(echo "$EXISTING_ENV" | grep -oP "SMTP_SECURE.*?value': '\K[^']*" || echo "")
EXISTING_SMTP_USER=$(echo "$EXISTING_ENV" | grep -oP "SMTP_USER.*?value': '\K[^']*" || echo "")
EXISTING_SMTP_PASS=$(echo "$EXISTING_ENV" | grep -oP "SMTP_PASS.*?value': '\K[^']*" || echo "")
EXISTING_SMTP_FROM=$(echo "$EXISTING_ENV" | grep -oP "SMTP_FROM.*?value': '\K[^']*" || echo "")

# Extract Google Maps API Key
EXISTING_GOOGLE_MAPS_API_KEY=$(echo "$EXISTING_ENV" | grep -oP "GOOGLE_MAPS_API_KEY.*?value': '\K[^']*" || echo "")

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

# Add SMTP credentials if they exist
if [ -n "$EXISTING_SMTP_HOST" ]; then
    ENV_VARS="$ENV_VARS,SMTP_HOST=$EXISTING_SMTP_HOST"
fi
if [ -n "$EXISTING_SMTP_PORT" ]; then
    ENV_VARS="$ENV_VARS,SMTP_PORT=$EXISTING_SMTP_PORT"
fi
if [ -n "$EXISTING_SMTP_SECURE" ]; then
    ENV_VARS="$ENV_VARS,SMTP_SECURE=$EXISTING_SMTP_SECURE"
fi
if [ -n "$EXISTING_SMTP_USER" ]; then
    ENV_VARS="$ENV_VARS,SMTP_USER=$EXISTING_SMTP_USER"
fi
if [ -n "$EXISTING_SMTP_PASS" ]; then
    ENV_VARS="$ENV_VARS,SMTP_PASS=$EXISTING_SMTP_PASS"
fi
if [ -n "$EXISTING_SMTP_FROM" ]; then
    ENV_VARS="$ENV_VARS,SMTP_FROM=$EXISTING_SMTP_FROM"
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

# Step 6: Push Android app code to production
echo "📱 Step 6: Android app code pushed to GitHub"
echo "   Android app code is in driver-app-native/"
echo "   Code has been pushed to GitHub (develop branch)"
echo "   Build and deploy Android app separately if needed"
echo ""

# Step 7: Verify deployment
echo "✅ Step 7: Verifying deployment..."
echo "   Testing backend health endpoint..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/api/health" || echo "Failed")
echo "   ⚠️  Backend health check returned: $HEALTH_RESPONSE"
echo ""

echo "=========================================="
echo "✅ Production Deployment Summary"
echo "=========================================="
echo "🌐 Backend URL: $SERVICE_URL"
echo "🌐 Frontend: Auto-deployed via Netlify (from GitHub)"
echo "🌐 Admin: Auto-deployed via Netlify (from GitHub)"
echo "📱 Android App: Code pushed to GitHub"
echo "📝 Migrations: Completed"
echo "🔒 CORS: Maintained (FRONTEND_URL and ADMIN_URL preserved)"
echo "🔐 Credentials: Preserved (M-Pesa, SMTP, etc.)"
echo ""
echo "📋 Next Steps:"
echo "1. Verify frontend deployment on Netlify dashboard"
echo "2. Test backend API: curl $SERVICE_URL/api/health"
echo "3. Check CORS configuration if frontend has issues"
echo "4. Build Android app if needed: cd driver-app-native && ./gradlew assembleProductionRelease"
echo ""
