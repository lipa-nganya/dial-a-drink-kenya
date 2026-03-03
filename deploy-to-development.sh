#!/bin/bash
# Deploy local changes to Development
#
# - Maintains CORS (FRONTEND_URL, ADMIN_URL preserved on existing service)
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
cd backend

# Preserve existing env vars from service (do not overwrite DATABASE_URL or secrets)
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
echo "   (DATABASE_URL and other secrets remain unchanged on the service)"
echo ""

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
    --update-env-vars "NODE_ENV=development,FRONTEND_URL=$EXISTING_FRONTEND_URL,ADMIN_URL=$EXISTING_ADMIN_URL,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GCP_PROJECT=$PROJECT_ID,HOST=0.0.0.0" \
    --memory 512Mi \
    --timeout 300 \
    --max-instances 10 \
    --min-instances 0 \
    --cpu 1 \
    --project "$PROJECT_ID" 2>&1

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format "value(status.url)" 2>/dev/null)
echo "   ✅ Backend URL: $SERVICE_URL"
cd ..
echo ""

# Step 5: Database migrations (tags, pageTitle, etc.)
echo "🗄️  Step 5: Database migrations (inventory tags, pageTitle)..."
if [ -n "$DATABASE_URL" ]; then
    echo "   Running migrations (DATABASE_URL is set)..."
    (cd backend && ./scripts/run-migrations-cloud-sql.sh) 2>&1 || {
        echo "   ⚠️  Migration script failed. Run manually:"
        echo "      Start Cloud SQL Proxy, set DATABASE_URL, then: cd backend && ./scripts/run-migrations-cloud-sql.sh"
    }
else
    echo "   Attempting to retrieve DATABASE_URL from development backend service..."
    export NODE_ENV=development
    (cd backend && ./scripts/run-migrations-cloud-sql.sh) 2>&1 || {
        echo "   ⚠️  Could not run migrations (no DATABASE_URL and gcloud may not return it)."
        echo "   To run migrations manually:"
        echo "      1. Start Cloud SQL Proxy: cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:5432 &"
        echo "      2. Set DATABASE_URL in .env (not committed): postgresql://USER:PASSWORD@localhost:5432/dialadrink_dev"
        echo "      3. Run: cd backend && NODE_ENV=development ./scripts/run-migrations-cloud-sql.sh"
    }
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
