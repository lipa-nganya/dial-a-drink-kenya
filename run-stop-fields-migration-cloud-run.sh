#!/bin/bash

# Run stop fields migration via Cloud Run Job
# This creates a temporary Cloud Run job to execute the migration

set -e

echo "🚀 Running Stop Fields Migration via Cloud Run Job"
echo "==================================================="
echo ""

PROJECT_ID="dialadrink-production"
REGION="us-central1"
JOB_NAME="run-stop-fields-migration-$(date +%s)"
SERVICE_NAME="deliveryos-development-backend"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"

echo "📦 Creating Cloud Run job: $JOB_NAME"
echo ""

# Get the backend service image
IMAGE=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
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
  --project $PROJECT_ID \
  --format="value(spec.template.spec.containers[0].env[?(@.name=='DATABASE_URL')].value)" 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  Could not retrieve DATABASE_URL from service, using default..."
  DATABASE_URL="postgresql://dialadrink_app:o61yqm5fLiTwWnk5@/dialadrink_dev?host=/cloudsql/${CONNECTION_NAME}"
fi

echo "✅ Using DATABASE_URL: postgresql://dialadrink_app:***@/dialadrink_dev?host=/cloudsql/${CONNECTION_NAME}"
echo ""

# Create and run the job
echo "🔨 Creating Cloud Run job..."
gcloud run jobs create $JOB_NAME \
  --image=$IMAGE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --set-env-vars="NODE_ENV=development,DATABASE_URL=$DATABASE_URL" \
  --command="node" \
  --args="scripts/run-stop-fields-migration.js" \
  --set-cloudsql-instances=$CONNECTION_NAME \
  --max-retries=1 \
  --task-timeout=600 \
  --memory=512Mi \
  --cpu=1 \
  --quiet

echo "✅ Job created"
echo ""

# Execute the job
echo "▶️  Executing job..."
gcloud run jobs execute $JOB_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --wait

# Get job execution status
echo ""
echo "📊 Job execution completed"
echo ""

# Show logs
echo "📋 Recent job logs:"
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=$JOB_NAME" \
  --limit 20 \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --project=$PROJECT_ID 2>/dev/null || echo "Could not retrieve logs"

echo ""

# Clean up
echo "🧹 Cleaning up job..."
gcloud run jobs delete $JOB_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --quiet

echo "✅ Migration job completed and cleaned up"
