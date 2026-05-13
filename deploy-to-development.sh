#!/bin/bash
# Deploy local changes to Development
#
# - Maintains CORS (FRONTEND_URL, ADMIN_URL preserved on existing service)
# - SMTP: reads backend/.env.local (and .env) and syncs SMTP_* to the dev backend so
#   international customers receive OTP emails (same as local). No need to set SMTP in GCP manually.
# - No new backend service (updates deliveryos-development-backend)
# - No new frontend services (Netlify picks up from GitHub)
# - Pushes Android app code to GitHub (develop); build separately if needed
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

# Dev-only Cloud Run cost controls (single QC user). Backend min instances 0 unless overridden.
# Override via env vars when needed.
DEV_BACKEND_MIN_INSTANCES="${DEV_BACKEND_MIN_INSTANCES:-0}"
DEV_BACKEND_MAX_INSTANCES="${DEV_BACKEND_MAX_INSTANCES:-1}"
# Cloud Run requires at least 1 CPU when concurrency is greater than 1.
DEV_BACKEND_CPU="${DEV_BACKEND_CPU:-1}"
DEV_BACKEND_MEMORY="${DEV_BACKEND_MEMORY:-256Mi}"
DEV_BACKEND_TIMEOUT="${DEV_BACKEND_TIMEOUT:-90}"
# Keep max instances at 1 for cost, but allow parallel admin/API startup calls.
DEV_BACKEND_CONCURRENCY="${DEV_BACKEND_CONCURRENCY:-20}"
REVISION_KEEP_COUNT="${REVISION_KEEP_COUNT:-10}"

prune_service_revisions() {
  local service_name="$1"
  local keep_count="$2"
  echo "   Service: $service_name (keep newest $keep_count)"
  local to_delete
  to_delete="$(gcloud run revisions list \
    --service "$service_name" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --sort-by="~metadata.creationTimestamp" \
    --format="value(metadata.name)" | tail -n +"$((keep_count + 1))")"

  if [ -z "$to_delete" ]; then
    echo "   No old revisions to delete."
    return 0
  fi

  while IFS= read -r revision; do
    [ -z "$revision" ] && continue
    echo "   Deleting revision: $revision"
    if ! gcloud run revisions delete "$revision" \
      --region "$REGION" \
      --project "$PROJECT_ID" \
      --quiet >/dev/null 2>&1; then
      echo "   ⚠️  Could not delete revision: $revision"
    fi
  done <<< "$to_delete"
}

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
    git commit -m "Deploy to development: inventory tags & pageTitle, backend updates" 2>/dev/null || true
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
echo "   Cloud Run: min-instances=$DEV_BACKEND_MIN_INSTANCES max-instances=$DEV_BACKEND_MAX_INSTANCES (CPU/memory/concurrency applied in tuning step)"
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_TAG" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CONNECTION_NAME" \
    --update-env-vars "$UPDATE_ENV_VARS" \
    --min-instances="$DEV_BACKEND_MIN_INSTANCES" \
    --max-instances="$DEV_BACKEND_MAX_INSTANCES" \
    --cpu="$DEV_BACKEND_CPU" \
    --memory="$DEV_BACKEND_MEMORY" \
    --timeout="$DEV_BACKEND_TIMEOUT" \
    --concurrency="$DEV_BACKEND_CONCURRENCY" \
    --cpu-throttling \
    --project "$PROJECT_ID" 2>&1

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null)
echo "   ✅ Backend URL: $SERVICE_URL"
cd ..
echo ""

# Step 5: Apply dev-only Cloud Run cost controls (backend only)
echo "💸 Step 5: Applying development Cloud Run cost controls (backend only)..."
chmod +x ./scripts/gcp/tune-cloud-run-dialadrink-development.sh
GCP_PROJECT_ID="$PROJECT_ID" \
GCP_REGION="$REGION" \
BACKEND_SERVICE="$SERVICE_NAME" \
BACKEND_MIN_INSTANCES="$DEV_BACKEND_MIN_INSTANCES" \
BACKEND_MAX_INSTANCES="$DEV_BACKEND_MAX_INSTANCES" \
BACKEND_CPU="$DEV_BACKEND_CPU" \
BACKEND_MEMORY="$DEV_BACKEND_MEMORY" \
BACKEND_TIMEOUT="$DEV_BACKEND_TIMEOUT" \
BACKEND_CONCURRENCY="$DEV_BACKEND_CONCURRENCY" \
  ./scripts/gcp/tune-cloud-run-dialadrink-development.sh
echo ""

# Step 6: Prune dev backend images (keep latest 3; delete tagged + untagged)
echo "🧹 Step 6: Pruning dev backend images (keep latest 3)..."
chmod +x ./scripts/gcp/gcr-prune-keep-latest-n.sh
GCP_PROJECT_ID="$PROJECT_ID" KEEP_N=3 IMAGES="deliveryos-backend-dev" \
  ./scripts/gcp/gcr-prune-keep-latest-n.sh
echo ""

# Step 7: Prune Cloud Run revisions (failed revisions first, then excess old ones)
echo "🗂️  Step 7: Pruning Cloud Run revisions..."
chmod +x ./scripts/gcp/delete-failed-cloud-run-revisions.sh
echo "   7a) Removing revisions in error state (Ready=False)..."
./scripts/gcp/delete-failed-cloud-run-revisions.sh "$SERVICE_NAME" "$REGION" "$PROJECT_ID" || true
echo "   7b) Removing excess old revisions (keep newest $REVISION_KEEP_COUNT)..."
prune_service_revisions "$SERVICE_NAME" "$REVISION_KEEP_COUNT"
echo ""

# Step 8: CORS and summary
echo "🔒 CORS: Maintained (backend/app.js uses FRONTEND_URL, ADMIN_URL)"
echo ""
echo "=========================================="
echo "✅ Deployment summary"
echo "=========================================="
echo "   Backend:  $SERVICE_URL"
echo "   Frontend: Netlify (from GitHub develop)"
echo "   Android:  driver-app-native (push to GitHub done; build APK: cd driver-app-native && ./gradlew assembleDevelopmentDebug)"
echo ""
echo "   Health: curl $SERVICE_URL/api/health"
echo ""
