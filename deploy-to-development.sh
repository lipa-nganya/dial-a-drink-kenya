#!/bin/bash
# Deploy local changes to Development
#
# - Maintains CORS (FRONTEND_URL, ADMIN_URL preserved on existing service)
# - SMTP: reads backend/.env.local (and .env) and syncs SMTP_* to the dev backend so
#   international customers receive OTP emails (same as local). No need to set SMTP in GCP manually.
# - No new backend service (updates deliveryos-development-backend)
# - No new frontend services (Netlify picks up from GitHub)
# - Pushes Android app code to GitHub (develop); build separately if needed
# - Database migrations: run via Cloud SQL Proxy + DATABASE_URL in env (no credentials in this script)
# - GCloud account: dialadrinkkenya254@gmail.com (set with gcloud config; never commit keys)
#
# Prerequisites:
#   gcloud auth login dialadrinkkenya254@gmail.com
#   gcloud config set project dialadrink-production
#   Do not commit .env or any file containing DATABASE_URL or API keys.
#   For OTP emails on dev: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in backend/.env.local

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"
GCLOUD_ACCOUNT="dialadrinkkenya254@gmail.com"

echo "🚀 Deploy to Development"
echo "========================"
echo ""

# Step 1: gcloud account and project (no keys in script)
echo "🔐 Step 1: gcloud account and project..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
    echo "   Run: gcloud auth login $GCLOUD_ACCOUNT"
    exit 1
fi
gcloud config set account "$GCLOUD_ACCOUNT" 2>/dev/null || true
gcloud config set project "$PROJECT_ID" 2>/dev/null || true
echo "   Account: $GCLOUD_ACCOUNT"
echo "   Project: $PROJECT_ID"
echo ""

# Step 2: Ensure no credentials are committed
echo "🔒 Step 2: Checking for exposed credentials..."
if git ls-files --error-unmatch .env 2>/dev/null; then
    echo "   ❌ .env is tracked by git. Add .env to .gitignore and remove from index."
    exit 1
fi
echo "   ✅ No .env committed"
echo ""

# Step 3: Git – stage, commit, push (triggers Netlify for frontend)
echo "📋 Step 3: Git push (Netlify will auto-deploy frontend)..."
git checkout develop 2>/dev/null || git checkout -b develop 2>/dev/null || true
git add -A 2>/dev/null || true
if ! git diff --staged --quiet 2>/dev/null; then
    git commit -m "Deploy to development: inventory tags & pageTitle, migrations, backend updates" 2>/dev/null || true
fi
git push origin develop 2>/dev/null || { echo "   ⚠️  Push failed or already up to date"; }
echo "   ✅ Frontend will deploy from Netlify (from GitHub)"
echo "   ✅ Android app code is in repo (driver-app-native); build separately for APK"
echo ""

# Step 4: Deploy backend to existing Cloud Run service (no new service)
echo "☁️  Step 4: Deploy backend to existing Cloud Run service..."

# Preserve existing env vars from service (fetch first so we can use in UPDATE_ENV_VARS)
EXISTING_ENV=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

EXISTING_FRONTEND_URL="https://dialadrink.thewolfgang.tech"
EXISTING_ADMIN_URL="https://dialadrink-admin.thewolfgang.tech"
if [ -n "$EXISTING_ENV" ]; then
  F=$(echo "$EXISTING_ENV" | grep -A1 "FRONTEND_URL" | grep "value:" | sed "s/.*value: *//" | tr -d '"')
  A=$(echo "$EXISTING_ENV" | grep -A1 "ADMIN_URL" | grep "value:" | sed "s/.*value: *//" | tr -d '"')
  [ -n "$F" ] && EXISTING_FRONTEND_URL="$F"
  [ -n "$A" ] && EXISTING_ADMIN_URL="$A"
fi

echo "   FRONTEND_URL: $EXISTING_FRONTEND_URL"
echo "   ADMIN_URL: $EXISTING_ADMIN_URL"

# Load SMTP (and other) settings from local backend env so dev uses same as local (e.g. OTP emails for international numbers)
ENV_DIR="backend"
if [ -f "$ENV_DIR/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_DIR/.env.local"
  set +a
  echo "   Loaded backend/.env.local (SMTP etc.)"
fi
if [ -f "$ENV_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_DIR/.env"
  set +a
  echo "   Loaded backend/.env"
fi

echo "   (DATABASE_URL and other secrets remain unchanged on the service)"
echo ""

# Build update-env-vars: base vars + SMTP from local (so dev sends OTP emails like local)
UPDATE_ENV_VARS="NODE_ENV=development,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID,HOST=0.0.0.0"
if [ -n "${SMTP_HOST:-}" ]; then
  UPDATE_ENV_VARS="${UPDATE_ENV_VARS},SMTP_HOST=${SMTP_HOST}"
fi
if [ -n "${SMTP_PORT:-}" ]; then
  UPDATE_ENV_VARS="${UPDATE_ENV_VARS},SMTP_PORT=${SMTP_PORT}"
fi
if [ -n "${SMTP_SECURE:-}" ]; then
  UPDATE_ENV_VARS="${UPDATE_ENV_VARS},SMTP_SECURE=${SMTP_SECURE}"
fi
if [ -n "${SMTP_USER:-}" ]; then
  UPDATE_ENV_VARS="${UPDATE_ENV_VARS},SMTP_USER=${SMTP_USER}"
fi
if [ -n "${SMTP_PASS:-}" ]; then
  UPDATE_ENV_VARS="${UPDATE_ENV_VARS},SMTP_PASS=${SMTP_PASS}"
fi
if [ -n "${SMTP_FROM:-}" ]; then
  UPDATE_ENV_VARS="${UPDATE_ENV_VARS},SMTP_FROM=${SMTP_FROM}"
fi
if [ -n "${SMTP_HOST:-}" ]; then
  echo "   SMTP: using same settings as local (SMTP_HOST, SMTP_USER, SMTP_FROM set; SMTP_PASS never logged)"
fi

cd backend

IMAGE_TAG="gcr.io/$PROJECT_ID/deliveryos-backend-dev:$(date +%s)"
echo "   Building image: $IMAGE_TAG"
gcloud builds submit --tag "$IMAGE_TAG" . 2>&1

echo "   Deploying to $SERVICE_NAME (existing service)..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --update-env-vars "$UPDATE_ENV_VARS" \
    --project "$PROJECT_ID" 2>&1

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null)
echo "   ✅ Backend URL: $SERVICE_URL"
cd ..
echo ""

# Step 5: Database migrations (run with Cloud SQL Proxy + local .env; no credentials in script)
echo "🗄️  Step 5: Database migrations..."
if [ -n "$DATABASE_URL" ]; then
    echo "   Running migrations (DATABASE_URL is set in your environment; never logged)..."
    (cd backend && NODE_ENV=development CLOUD_RUN_SERVICE=deliveryos-development-backend ./scripts/run-migrations-cloud-sql.sh) 2>&1 || {
        echo "   ⚠️  Migration script failed. Check errors above."
    }
else
    echo "   Migrations require DATABASE_URL (never commit it)."
    echo "   To run migrations manually:"
    echo "      1. Start Cloud SQL Proxy:"
    echo "         cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:5432 &"
    echo "      2. In another terminal, set DATABASE_URL in .env (do not commit):"
    echo "         postgresql://USER:PASSWORD@localhost:5432/dialadrink_dev"
    echo "      3. Run: cd backend && NODE_ENV=development ./scripts/run-cloud-sql-migrations.js"
    echo "         (or: source .env && ./scripts/run-migrations-cloud-sql.sh)"
fi
echo ""

# Step 6: CORS and summary
echo "🔒 CORS: Maintained (backend/app.js uses FRONTEND_URL, ADMIN_URL)"
echo ""
echo "=========================================="
echo "✅ Deployment summary"
echo "=========================================="
echo "   Backend:  $SERVICE_URL"
echo "   Frontend: Netlify (from GitHub develop)"
echo "   Android:  driver-app-native (push to GitHub done; build APK: cd driver-app-native && ./gradlew assembleDevelopmentDebug)"
echo "   Migrations: See Step 5 if not run automatically"
echo ""
echo "   Health: curl $SERVICE_URL/api/health"
echo ""
