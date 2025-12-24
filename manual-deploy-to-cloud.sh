#!/bin/bash
# Manual deployment script - Deploys directly from GitHub to Cloud Run
# This works without Cloud Build triggers

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"

echo "🚀 Manual deployment from GitHub to Cloud Run"
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Get the latest commit SHA from GitHub
echo "📥 Fetching latest commit from GitHub..."
LATEST_SHA=$(git ls-remote https://github.com/lipa-nganya/dial-a-drink-kenya.git main | cut -f1)
SHORT_SHA=${LATEST_SHA:0:7}

echo "   Latest commit: $SHORT_SHA"
echo ""

# Deploy backend
echo "🔨 Deploying backend..."
gcloud builds submit \
  --config=backend/cloudbuild.yaml \
  --substitutions=SHORT_SHA=$SHORT_SHA \
  --project=$PROJECT_ID \
  --region=$REGION \
  backend/

echo ""
echo "✅ Backend deployed"
echo ""

# Deploy frontend
echo "🔨 Deploying frontend..."
gcloud builds submit \
  --config=frontend/cloudbuild.yaml \
  --substitutions=SHORT_SHA=$SHORT_SHA \
  --project=$PROJECT_ID \
  --region=$REGION \
  frontend/

echo ""
echo "✅ Frontend deployed"
echo ""

# Deploy admin
echo "🔨 Deploying admin..."
gcloud builds submit \
  --config=admin-frontend/cloudbuild.yaml \
  --substitutions=SHORT_SHA=$SHORT_SHA \
  --project=$PROJECT_ID \
  --region=$REGION \
  admin-frontend/

echo ""
echo "✅ Admin deployed"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "✅ All services deployed successfully!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Service URLs:"
echo "   Backend: https://deliveryos-backend-910510650031.us-central1.run.app"
echo "   Frontend: https://deliveryos-customer-910510650031.us-central1.run.app"
echo "   Admin: https://deliveryos-admin-910510650031.us-central1.run.app"
echo ""

