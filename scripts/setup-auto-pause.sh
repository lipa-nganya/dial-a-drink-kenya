#!/bin/bash
# Setup Cloud Scheduler to automatically stop/start Cloud SQL instance
# This simulates "auto-pause" functionality for cost savings

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
INSTANCE_NAME="drink-suite-db"
TIMEZONE="Africa/Nairobi"

# Service account for Cloud Scheduler (will be created if needed)
SERVICE_ACCOUNT="cloud-sql-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🔧 Setting up Cloud Scheduler for auto-pause functionality"
echo ""

# Step 1: Create service account for Cloud Scheduler
echo "Step 1: Creating service account..."
if ! gcloud iam service-accounts describe $SERVICE_ACCOUNT --project=$PROJECT_ID &>/dev/null; then
  gcloud iam service-accounts create cloud-sql-scheduler \
    --display-name="Cloud SQL Scheduler" \
    --project=$PROJECT_ID
  
  echo "Waiting for service account to propagate..."
  sleep 5
  
  # Grant necessary permissions
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/cloudsql.admin" \
    --quiet
  
  echo "✅ Service account created"
else
  echo "✅ Service account already exists"
  # Ensure permissions are set
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/cloudsql.admin" \
    --quiet 2>/dev/null || echo "Permissions already set"
fi

# Step 2: Create Cloud Function to stop instance
echo ""
echo "Step 2: Creating Cloud Function to stop instance..."
cat > /tmp/stop_instance.py << 'EOF'
import functions_framework
from googleapiclient.discovery import build
from google.oauth2 import service_account
import os

@functions_framework.http
def stop_instance(request):
    project_id = os.environ.get('PROJECT_ID')
    instance_name = os.environ.get('INSTANCE_NAME')
    region = os.environ.get('REGION')
    
    service = build('sqladmin', 'v1')
    request = service.instances().stop(
        project=project_id,
        instance=instance_name
    )
    response = request.execute()
    
    return {'status': 'success', 'message': f'Instance {instance_name} stopped'}
EOF

# Step 3: Create Cloud Function to start instance
echo ""
echo "Step 3: Creating Cloud Function to start instance..."
cat > /tmp/start_instance.py << 'EOF'
import functions_framework
from googleapiclient.discovery import build
import os

@functions_framework.http
def start_instance(request):
    project_id = os.environ.get('PROJECT_ID')
    instance_name = os.environ.get('INSTANCE_NAME')
    region = os.environ.get('REGION')
    
    service = build('sqladmin', 'v1')
    request = service.instances().start(
        project=project_id,
        instance=instance_name
    )
    response = request.execute()
    
    return {'status': 'success', 'message': f'Instance {instance_name} started'}
EOF

# Step 4: Deploy Cloud Functions
echo ""
echo "Step 4: Deploying Cloud Functions..."

# Deploy stop function
gcloud functions deploy stop-cloud-sql-instance \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=/tmp \
  --entry-point=stop_instance \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=$SERVICE_ACCOUNT \
  --set-env-vars="PROJECT_ID=${PROJECT_ID},INSTANCE_NAME=${INSTANCE_NAME},REGION=${REGION}" \
  --project=$PROJECT_ID

# Deploy start function
gcloud functions deploy start-cloud-sql-instance \
  --gen2 \
  --runtime=python311 \
  --region=$REGION \
  --source=/tmp \
  --entry-point=start_instance \
  --trigger-http \
  --allow-unauthenticated \
  --service-account=$SERVICE_ACCOUNT \
  --set-env-vars="PROJECT_ID=${PROJECT_ID},INSTANCE_NAME=${INSTANCE_NAME},REGION=${REGION}" \
  --project=$PROJECT_ID

# Step 5: Create Cloud Scheduler jobs
echo ""
echo "Step 5: Creating Cloud Scheduler jobs..."

# Get function URLs
STOP_FUNCTION_URL=$(gcloud functions describe stop-cloud-sql-instance \
  --gen2 \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(serviceConfig.uri)")

START_FUNCTION_URL=$(gcloud functions describe start-cloud-sql-instance \
  --gen2 \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(serviceConfig.uri)")

# Create job to stop instance at 11 PM (low traffic time)
gcloud scheduler jobs create http stop-cloud-sql-daily \
  --location=$REGION \
  --schedule="0 23 * * *" \
  --uri=$STOP_FUNCTION_URL \
  --http-method=GET \
  --time-zone=$TIMEZONE \
  --project=$PROJECT_ID \
  --description="Stop Cloud SQL instance daily at 11 PM to save costs"

# Create job to start instance at 6 AM (before business hours)
gcloud scheduler jobs create http start-cloud-sql-daily \
  --location=$REGION \
  --schedule="0 6 * * *" \
  --uri=$START_FUNCTION_URL \
  --http-method=GET \
  --time-zone=$TIMEZONE \
  --project=$PROJECT_ID \
  --description="Start Cloud SQL instance daily at 6 AM"

echo ""
echo "✅ Auto-pause setup completed!"
echo ""
echo "📋 Schedule:"
echo "  - Stop: Daily at 11:00 PM ($TIMEZONE)"
echo "  - Start: Daily at 6:00 AM ($TIMEZONE)"
echo ""
echo "💡 Estimated cost savings: 7 hours/day × 30 days = 210 hours/month"
echo "   This can save ~30% on compute costs"

