#!/bin/bash
# Run tag + pageTitle sync against the *development* Cloud SQL database
# using the existing sync-all-tags-from-production-admin.js script.
#
# This:
# - Uses the latest image from deliveryos-development-backend (no new service)
# - Retrieves DATABASE_URL from the dev backend service (no credentials in this script)
# - Creates/updates a Cloud Run Job that runs the sync script
# - Executes the job and waits for completion
#
# Requirements:
#   gcloud auth login dialadrinkkenya254@gmail.com
#   gcloud config set project dialadrink-production

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"
JOB_NAME="sync-tags-from-production-admin-dev"

echo "🚀 Running tag + pageTitle sync on DEVELOPMENT database"
echo "======================================================="
echo ""

# Ensure project is set
gcloud config set project "$PROJECT_ID" >/dev/null 2>&1 || true

echo "📊 Retrieving DATABASE_URL from Cloud Run service ($SERVICE_NAME)..."
ENV_JSON=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format="json(spec.template.spec.containers[0].env)" 2>/dev/null || echo "{}")

# Use node to safely parse JSON and extract DATABASE_URL without exposing it in this script
DATABASE_URL=$(node -e 'const txt=process.argv[1]||"{}";let env=[];try{const d=JSON.parse(txt);env=(((d||{}).spec||{}).template||{}).spec?.containers?.[0]?.env||[]}catch(e){}const v=env.find(e=>e && e.name==="DATABASE_URL");if(v&&v.value)process.stdout.write(v.value);' "$ENV_JSON" || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Could not retrieve DATABASE_URL from $SERVICE_NAME."
  echo "   Set DATABASE_URL on the service first (via Console or a secure script), then re-run."
  exit 1
fi

# Mask password for logging
MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:\([^:@]*\)@/:***@/')
echo "✅ Using DATABASE_URL: ${MASKED_URL:0:80}..."
echo ""

echo "📊 Getting latest backend image from $SERVICE_NAME..."
LATEST_IMAGE=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)

if [ -z "$LATEST_IMAGE" ]; then
  echo "❌ Could not retrieve image from service $SERVICE_NAME"
  exit 1
fi

echo "✅ Using image: $LATEST_IMAGE"
echo ""

echo "📝 Creating/Updating Cloud Run Job: $JOB_NAME"
gcloud run jobs create "$JOB_NAME" \
  --image "$LATEST_IMAGE" \
  --region "$REGION" \
  --set-env-vars "NODE_ENV=development,DATABASE_URL=$DATABASE_URL" \
  --set-cloudsql-instances "$CONNECTION_NAME" \
  --max-retries 1 \
  --task-timeout 3600 \
  --project "$PROJECT_ID" \
  --command node \
  --args scripts/sync-all-tags-from-production-admin.js,--delay,1200 \
  >/dev/null 2>&1 || {
  echo "   Job already exists, updating..."
  gcloud run jobs update "$JOB_NAME" \
    --image "$LATEST_IMAGE" \
    --region "$REGION" \
    --set-env-vars "NODE_ENV=development,DATABASE_URL=$DATABASE_URL" \
    --set-cloudsql-instances "$CONNECTION_NAME" \
    --max-retries 1 \
    --task-timeout 3600 \
    --project "$PROJECT_ID" \
    --command node \
    --args scripts/sync-all-tags-from-production-admin.js,--delay,1200 \
    >/dev/null 2>&1
}

echo ""
echo "🚀 Executing Cloud Run Job: $JOB_NAME (this may take a while for 2077 products)..."
gcloud run jobs execute "$JOB_NAME" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --wait

echo ""
echo "✅ Tag + Page Title sync job completed for DEVELOPMENT database."
echo "   Check Cloud Run Job logs for detailed per-product output."

