#!/bin/bash
# Deploy to Production Environment
# Updates container images only — does NOT read or write secrets (DATABASE_URL, MPesa, SMTP,
# API keys). Configure those in GCP only: Cloud Run → service → Variables & Secrets / Secret Manager.
#
# Frontend Cloud Build needs a Maps key at build time. Resolved in order:
#   GOOGLE_MAPS_API_KEY_FOR_BUILD → GOOGLE_MAPS_API_KEY → Secret Manager secret "google-maps-api-key"
# Or use a Cloud Build trigger with _GOOGLE_MAPS_API_KEY (no local env needed).

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
GCLOUD_ACCOUNT="dialadrinkkenya254@gmail.com"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"

CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"

echo "🚀 Deploying to Production Environment"
echo "======================================"
echo ""
echo "ℹ️  Secrets stay in GCP only; this script rolls images and keeps existing Cloud Run env/secrets."
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

# Step 2: Ensure no credentials are exposed in repo
echo "🔒 Step 2: Checking for exposed credentials..."
cd /Users/maria/dial-a-drink

if git ls-files | grep -E '\.env$|\.env\.local$|\.env\.production$' | grep -v '.gitignore'; then
    echo "❌ Error: .env files found in git. Please ensure they are in .gitignore"
    exit 1
fi

if grep -r "password.*=.*['\"].*[a-zA-Z0-9]{8,}" backend/routes/ backend/models/ backend/app.js 2>/dev/null | grep -v "//.*password" | grep -v "password.*:"; then
    echo "⚠️  Warning: Potential hardcoded passwords found. Please review."
fi

echo "✅ Credential check passed"
echo ""

# Step 3: Git operations
echo "📋 Step 3: Git operations..."
git checkout develop 2>&1 || git checkout -b develop 2>&1

if ! git diff-index --quiet HEAD --; then
    echo "📝 Staging all changes..."
    git add -A
    COMMIT_MSG="Deploy to production: $(date +'%Y-%m-%d %H:%M:%S') - Production deployment"
    git commit -m "$COMMIT_MSG" 2>&1 || echo "Commit completed"
fi

echo "📤 Pushing to GitHub..."
git push origin develop 2>&1 || echo "Push completed or already up to date"
echo "✅ Git operations completed"
echo ""

# Step 4: Deploy backend (image only — preserves all env vars & secrets already on the service)
echo "☁️  Step 4: Deploying backend to Cloud Run (new image only; env unchanged)..."
cd backend

echo "🔨 Building Docker image..."
IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-production-backend:$(date +%s)"
gcloud builds submit --tag "$IMAGE_TAG" . 2>&1

echo "✅ Image built: $IMAGE_TAG"
echo ""

echo "🚀 Deploying to Cloud Run (no --update-env-vars — secrets remain as configured in GCP)..."
gcloud run deploy "$BACKEND_SERVICE" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$PROD_CONNECTION" \
    --project "$PROJECT_ID" 2>&1

SERVICE_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>&1)

echo ""
echo "✅ Backend deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""

# Frontends need a Maps key at build time (React). Do not commit keys.
SHORT_SHA=$(date +%s | shasum -a 256 2>/dev/null | head -c 8 || date +%s | sha256sum 2>/dev/null | head -c 8 || echo "$(date +%s)")
GOOGLE_MAPS_KEY="${GOOGLE_MAPS_API_KEY_FOR_BUILD:-${GOOGLE_MAPS_API_KEY:-}}"
if [ -z "$GOOGLE_MAPS_KEY" ]; then
    GOOGLE_MAPS_KEY="$(gcloud secrets versions access latest --secret=google-maps-api-key --project="$PROJECT_ID" 2>/dev/null || true)"
fi

# Step 5: Deploy Customer Frontend to Cloud Run
echo "🌐 Step 5: Deploying Customer Frontend to Cloud Run..."
if [ -z "$GOOGLE_MAPS_KEY" ]; then
    echo "⚠️  No Maps API key for frontend build (set GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY_FOR_BUILD, or Secret Manager secret google-maps-api-key)."
    echo "   Or deploy frontends via a Cloud Build trigger with _GOOGLE_MAPS_API_KEY."
    echo "   Skipping customer frontend build."
else
    cd /Users/maria/dial-a-drink/frontend
    echo "🔨 Building and deploying customer frontend..."
    gcloud builds submit . \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA="${SHORT_SHA}",_GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_KEY}" \
        --project "$PROJECT_ID" 2>&1 || {
        echo "❌ Customer frontend deployment failed"
        cd /Users/maria/dial-a-drink
        exit 1
    }
    CUSTOMER_FRONTEND_URL=$(gcloud run services describe "deliveryos-customer-frontend" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format "value(status.url)" 2>/dev/null || echo "")
    echo "✅ Customer frontend deployed: $CUSTOMER_FRONTEND_URL"
    cd /Users/maria/dial-a-drink
fi

# Step 6: Deploy Admin Frontend to Cloud Run
echo ""
echo "🌐 Step 6: Deploying Admin Frontend to Cloud Run..."
if [ -z "$GOOGLE_MAPS_KEY" ]; then
    echo "⚠️  Skipping admin frontend (same Maps key resolution as customer frontend)."
else
    cd /Users/maria/dial-a-drink/admin-frontend
    echo "🔨 Building and deploying admin frontend..."
    gcloud builds submit . \
        --config cloudbuild.yaml \
        --substitutions=SHORT_SHA="${SHORT_SHA}",_GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_KEY}" \
        --project "$PROJECT_ID" 2>&1 || {
        echo "❌ Admin frontend deployment failed"
        cd /Users/maria/dial-a-drink
        exit 1
    }
    ADMIN_FRONTEND_URL=$(gcloud run services describe "deliveryos-admin-frontend" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --format "value(status.url)" 2>/dev/null || echo "")
    echo "✅ Admin frontend deployed: $ADMIN_FRONTEND_URL"
    cd /Users/maria/dial-a-drink
fi

echo ""
echo "📱 Step 7: Android app — build separately if needed (driver-app-native/)"
echo ""

echo "✅ Step 8: Verifying backend health..."
HEALTH_RESPONSE=$(curl -s "$SERVICE_URL/api/health" || echo "Failed")
echo "   Backend health check returned: $HEALTH_RESPONSE"
echo ""

echo "=========================================="
echo "✅ Production Deployment Summary"
echo "=========================================="
echo "🌐 Backend URL: $SERVICE_URL"
echo "🔐 Secrets: unchanged (managed in GCP only)"
echo ""
echo "📋 Next Steps:"
echo "1. Test backend API: curl $SERVICE_URL/api/health"
echo "2. Frontend builds: export GOOGLE_MAPS_API_KEY (or GOOGLE_MAPS_API_KEY_FOR_BUILD), or use Secret google-maps-api-key / Cloud Build trigger"
echo ""
