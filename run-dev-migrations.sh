#!/bin/bash
# Run Database Migrations for Development Environment

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"
DATABASE_URL="postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/$CONNECTION_NAME"

echo "🚀 Running Development Database Migrations"
echo "=========================================="
echo ""

# Set project
gcloud config set project "$PROJECT_ID" 2>&1

# Get the latest image tag
echo "📊 Getting latest backend image..."
LATEST_IMAGE=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format="value(spec.template.spec.containers[0].image)" 2>&1)

if [ -z "$LATEST_IMAGE" ]; then
    echo "❌ Could not retrieve image from service"
    exit 1
fi

echo "✅ Using image: $LATEST_IMAGE"
echo ""

echo "📝 Creating Cloud Run Job for migrations..."
JOB_NAME="migration-job-dev"

# Create or update the job
gcloud run jobs create "$JOB_NAME" \
    --image "$LATEST_IMAGE" \
    --region "$REGION" \
    --set-env-vars "NODE_ENV=development,DATABASE_URL=$DATABASE_URL" \
    --set-cloudsql-instances "$CONNECTION_NAME" \
    --max-retries 1 \
    --task-timeout 600 \
    --project "$PROJECT_ID" \
    --command node \
    --args scripts/run-slug-migrations-sql.js 2>&1 || {
    echo "   Job already exists, updating..."
    gcloud run jobs update "$JOB_NAME" \
        --image "$LATEST_IMAGE" \
        --region "$REGION" \
        --set-env-vars "NODE_ENV=development,DATABASE_URL=$DATABASE_URL" \
        --set-cloudsql-instances "$CONNECTION_NAME" \
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
echo "✅ Migrations completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify the categories endpoint: curl https://deliveryos-development-backend-805803410802.us-central1.run.app/api/categories"
echo "2. Check backend logs if issues persist"
echo ""
