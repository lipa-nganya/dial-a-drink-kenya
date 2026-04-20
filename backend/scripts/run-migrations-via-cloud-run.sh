#!/bin/bash

# Run migrations via Cloud Run Job
# This creates a temporary Cloud Run job to execute the migrations

set -e

echo "🚀 Running migrations via Cloud Run Job"
echo "========================================"
echo ""

PROJECT_ID="drink-suite"
REGION="us-central1"
JOB_NAME="run-migrations-$(date +%s)"
SERVICE_NAME="deliveryos-backend"

echo "📦 Creating Cloud Run job: $JOB_NAME"
echo ""

# Get the backend service image
IMAGE=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format="value(spec.template.spec.containers[0].image)" 2>/dev/null)

if [ -z "$IMAGE" ]; then
  echo "❌ Could not find backend service image"
  exit 1
fi

echo "📊 Using image: $IMAGE"
echo ""

# Get DATABASE_URL from the service
DATABASE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format="value(spec.template.spec.containers[0].env)" 2>/dev/null | \
  grep -oP "DATABASE_URL.*?value': '\K[^']*" || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Could not retrieve DATABASE_URL"
  exit 1
fi

echo "✅ Retrieved DATABASE_URL"
echo ""

# Create and run the job
echo "🔨 Creating Cloud Run job..."
gcloud run jobs create $JOB_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --set-env-vars="NODE_ENV=production,DATABASE_URL=$DATABASE_URL" \
  --command="node" \
  --args="scripts/run-cloud-sql-migrations.js" \
  --add-cloudsql-instances="drink-suite:us-central1:drink-suite-db" \
  --max-retries=1 \
  --task-timeout=600 \
  --quiet

echo "✅ Job created"
echo ""

# Execute the job
echo "▶️  Executing job..."
gcloud run jobs execute $JOB_NAME \
  --region=$REGION \
  --wait

# Get job execution status
echo ""
echo "📊 Job execution completed"
echo ""

# Clean up
echo "🧹 Cleaning up job..."
gcloud run jobs delete $JOB_NAME \
  --region=$REGION \
  --quiet

echo "✅ Migration job completed and cleaned up"







