#!/bin/bash
# Setup script for Cloud Build automatic deployments
# This script helps configure Cloud Build triggers for automatic deployments

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
REPO_NAME="dial-a-drink-kenya"
REPO_OWNER="lipa-nganya"
BRANCH="main"

echo "🚀 Setting up Cloud Build for automatic deployments..."
echo ""

# Set project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo ""
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
echo "✅ APIs enabled"

# Grant Cloud Build permissions
echo ""
echo "🔐 Granting Cloud Build permissions..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Cloud Build Service Account: $CLOUD_BUILD_SA"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None

echo "✅ Permissions granted"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Cloud Build setup complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Connect GitHub Repository:"
echo "   Visit: https://console.cloud.google.com/cloud-build/triggers"
echo "   Click 'Connect Repository' → Select GitHub → Authenticate"
echo "   Select repository: $REPO_OWNER/$REPO_NAME"
echo ""
echo "2. Create Triggers (via Console):"
echo ""
echo "   Backend Trigger:"
echo "   - Name: deploy-backend"
echo "   - Event: Push to branch"
echo "   - Branch: ^main$"
echo "   - Config: backend/cloudbuild.yaml"
echo ""
echo "   Frontend Trigger:"
echo "   - Name: deploy-frontend"
echo "   - Event: Push to branch"
echo "   - Branch: ^main$"
echo "   - Config: frontend/cloudbuild.yaml"
echo ""
echo "   Admin Trigger:"
echo "   - Name: deploy-admin"
echo "   - Event: Push to branch"
echo "   - Branch: ^main$"
echo "   - Config: admin-frontend/cloudbuild.yaml"
echo ""
echo "3. Set Backend Environment Variables:"
echo "   Go to Cloud Run → dialadrink-backend → Edit"
echo "   Add: DATABASE_URL, MPESA_* variables, etc."
echo ""
echo "4. Test:"
echo "   git commit --allow-empty -m 'test: Trigger deployment'"
echo "   git push origin main"
echo ""
echo "📚 Full guide: SETUP_CLOUD_BUILD.md"
echo ""

