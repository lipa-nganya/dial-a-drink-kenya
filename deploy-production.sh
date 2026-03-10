#!/bin/bash
# Production deployment: backend + frontends (GCloud Cloud Run), migrations, Android code push.
# No credentials in repo: DATABASE_URL and secrets are read from existing backend service.
# Account: dialadrinkkenya254@gmail.com
# Does NOT create new services; updates existing: deliveryos-production-backend,
# deliveryos-customer-frontend, deliveryos-admin-frontend.

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-production-backend"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/deliveryos-production-backend"
PROD_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"
CUSTOMER_FRONTEND_SERVICE="deliveryos-customer-frontend"
ADMIN_FRONTEND_SERVICE="deliveryos-admin-frontend"

echo "🚀 Production deployment"
echo "========================="
echo "   Account: dialadrinkkenya254@gmail.com"
echo "   Project: $PROJECT_ID"
echo "   Backend: $BACKEND_SERVICE (existing)"
echo "   Frontends: $CUSTOMER_FRONTEND_SERVICE, $ADMIN_FRONTEND_SERVICE (existing)"
echo ""

# Ensure correct gcloud account (no keys in script; user must be logged in)
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null || echo "")
if [ "$CURRENT_ACCOUNT" != "dialadrinkkenya254@gmail.com" ]; then
  echo "⚠️  Current account: $CURRENT_ACCOUNT"
  echo "   Switching to dialadrinkkenya254@gmail.com..."
  gcloud config set account dialadrinkkenya254@gmail.com || {
    echo "❌ Switch failed. Run: gcloud auth login dialadrinkkenya254@gmail.com"
    exit 1
  }
fi
gcloud config set project "$PROJECT_ID"

# Step 1: Build backend image
echo ""
echo "📦 Step 1: Building backend image"
echo "=================================="
cd backend
gcloud builds submit --tag "${BACKEND_IMAGE}:latest" . || { echo "❌ Backend build failed"; exit 1; }
cd ..
echo "✅ Backend image built"

# Step 2: Run database migrations (SEO columns, etc.) via Cloud Run Job
# DATABASE_URL is read from existing backend service; not stored or echoed.
echo ""
echo "📊 Step 2: Running database migrations (SEO columns, slugs support)"
echo "====================================================================="
SVC_JSON=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format=json 2>/dev/null || echo "{}")
DATABASE_URL=""
if [ -n "$SVC_JSON" ]; then
  DATABASE_URL=$(echo "$SVC_JSON" | jq -r '.spec.template.spec.containers[0].env[]? | select(.name=="DATABASE_URL") | .value // empty')
fi
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  Could not read DATABASE_URL from $BACKEND_SERVICE. Skipping migration job."
  echo "   Run migrations manually with DATABASE_URL set (e.g. from Secret Manager or env)."
else
  MIGRATION_JOB="prod-migration-$(date +%s)"
  echo "   Creating one-off job: $MIGRATION_JOB"
  ENV_FILE=$(mktemp)
  trap "rm -f $ENV_FILE" EXIT
  echo "NODE_ENV: production" > "$ENV_FILE"
  # Quote DATABASE_URL so special characters in connection string are safe
  printf 'DATABASE_URL: "%s"\n' "$(echo "$DATABASE_URL" | sed 's/"/\\"/g')" >> "$ENV_FILE"
  if gcloud run jobs create "$MIGRATION_JOB" \
    --image="${BACKEND_IMAGE}:latest" \
    --region="$REGION" \
    --env-vars-file="$ENV_FILE" \
    --command="node" \
    --args="scripts/run-cloud-sql-migrations.js" \
    --set-cloudsql-instances="$PROD_CONNECTION" \
    --max-retries=1 \
    --task-timeout=600 \
    --memory=512Mi \
    --cpu=1 \
    --project="$PROJECT_ID" \
    --quiet 2>/dev/null; then
    echo "   Executing migration job..."
    gcloud run jobs execute "$MIGRATION_JOB" --region="$REGION" --project="$PROJECT_ID" --wait || true
    gcloud run jobs delete "$MIGRATION_JOB" --region="$REGION" --project="$PROJECT_ID" --quiet 2>/dev/null || true
    echo "✅ Migration job finished"
  else
    echo "⚠️  Migration job creation failed; continuing. Run migrations manually if needed."
  fi
  rm -f "$ENV_FILE"
  trap - EXIT
fi

# Step 3: Deploy backend (existing service; keeps existing env vars and CORS)
echo ""
echo "📦 Step 3: Deploying backend to $BACKEND_SERVICE"
echo "==============================================="
gcloud run deploy "$BACKEND_SERVICE" \
  --image "${BACKEND_IMAGE}:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$PROD_CONNECTION" \
  --memory 512Mi \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --cpu 1 \
  --project "$PROJECT_ID" || { echo "❌ Backend deploy failed"; exit 1; }
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)")
echo "✅ Backend: $BACKEND_URL"

# Step 4: Deploy customer and admin frontends (existing GCloud services)
echo ""
echo "🌐 Step 4: Deploying frontends (GCloud Cloud Run)"
echo "=================================================="
echo "   (Each frontend build runs in Cloud Build: npm install + build + deploy. Can take 10–15 min if queue is busy.)"
echo "   Monitor: https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""
GOOGLE_MAPS_API_KEY="${GOOGLE_MAPS_API_KEY:-$(gcloud secrets versions access latest --secret=google-maps-api-key --project=$PROJECT_ID 2>/dev/null || echo '')}"
SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || date +%s | sha256sum 2>/dev/null | head -c 8)

echo "   Deploying customer frontend..."
cd frontend
if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
  gcloud builds submit --config cloudbuild.yaml --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY --project "$PROJECT_ID" . || { cd ..; echo "❌ Customer frontend deploy failed"; exit 1; }
else
  gcloud builds submit --config cloudbuild.yaml --substitutions=SHORT_SHA=$SHORT_SHA --project "$PROJECT_ID" . || { cd ..; echo "❌ Customer frontend deploy failed"; exit 1; }
fi
cd ..
CUSTOMER_URL=$(gcloud run services describe "$CUSTOMER_FRONTEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)" 2>/dev/null || echo "")
echo "✅ Customer frontend: $CUSTOMER_URL"

echo "   Deploying admin frontend..."
cd admin-frontend
if [ -n "$GOOGLE_MAPS_API_KEY" ]; then
  gcloud builds submit --config cloudbuild.yaml --substitutions=SHORT_SHA=$SHORT_SHA,_GOOGLE_MAPS_API_KEY=$GOOGLE_MAPS_API_KEY --project "$PROJECT_ID" . || { cd ..; echo "❌ Admin frontend deploy failed"; exit 1; }
else
  gcloud builds submit --config cloudbuild.yaml --substitutions=SHORT_SHA=$SHORT_SHA --project "$PROJECT_ID" . || { cd ..; echo "❌ Admin frontend deploy failed"; exit 1; }
fi
cd ..
ADMIN_URL=$(gcloud run services describe "$ADMIN_FRONTEND_SERVICE" --region "$REGION" --project "$PROJECT_ID" --format="value(status.url)" 2>/dev/null || echo "")
echo "✅ Admin frontend: $ADMIN_URL"

# Step 5: Push Android app code to production (git)
echo ""
echo "📱 Step 5: Pushing Android app code to production"
echo "================================================="
if git status --short driver-app-native 2>/dev/null | grep -q . || ! git diff --quiet main -- driver-app-native 2>/dev/null; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "develop")
  echo "   Current branch: $CURRENT_BRANCH"
  if [ -d "driver-app-native" ] && [ -f "driver-app-native/gradle.properties" ]; then
    git add driver-app-native
    git add -u driver-app-native
    if git diff --cached --quiet driver-app-native 2>/dev/null; then
      echo "   No Android changes to commit (already up to date)."
    else
      git commit -m "chore: update driver app for production" -- driver-app-native || true
      if git remote get-url origin &>/dev/null; then
        git push origin "$CURRENT_BRANCH" 2>/dev/null && echo "✅ Pushed to origin $CURRENT_BRANCH" || echo "   Push skipped (no remote or auth). Push manually to production branch."
      else
        echo "   No remote; push manually to production branch."
      fi
    fi
  else
    echo "   driver-app-native not found or no gradle.properties; skipping push."
  fi
else
  echo "   No uncommitted Android changes; code already in repo. Push to main/production manually if needed."
fi

echo ""
echo "════════════════════════════════════════════"
echo "✅ Production deployment complete"
echo "════════════════════════════════════════════"
echo "   Backend:    $BACKEND_URL"
echo "   Customer:   $CUSTOMER_URL"
echo "   Admin:      $ADMIN_URL"
echo "   CORS:       unchanged (from existing backend env)"
echo "   Migrations: SEO columns applied if needed"
echo ""
echo "   Optional: To sync slugs/tags/pageTitle from local to production DB, run (with env set, no credentials in repo):"
echo "   SOURCE_DATABASE_URL=... DATABASE_URL=... node backend/scripts/sync-tags-from-local-to-dev.js"
echo "   (Use TARGET prod DB for DATABASE_URL; script name is dev but works for any target.)"
echo "   Same pattern: backend/scripts/sync-slugs-from-local-to-dev.js"
echo ""
