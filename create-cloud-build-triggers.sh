#!/bin/bash
# Script to create Cloud Build triggers for automatic deployments from GitHub

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
REPO_NAME="dial-a-drink-kenya"
REPO_OWNER="lipa-nganya"
BRANCH="main"

echo "🚀 Creating Cloud Build triggers for automatic deployments..."
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Check if GitHub connection exists
echo "📋 Checking GitHub repository connection..."
CONNECTED_REPOS=$(gcloud source repos list --project=$PROJECT_ID 2>/dev/null | grep -i "$REPO_NAME" || echo "")

if [ -z "$CONNECTED_REPOS" ]; then
    echo "⚠️  GitHub repository not connected yet."
    echo ""
    echo "📝 To connect your GitHub repository:"
    echo "   1. Visit: https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
    echo "   2. Click 'Connect Repository'"
    echo "   3. Select 'GitHub (Cloud Build GitHub App)'"
    echo "   4. Authenticate and select repository: $REPO_OWNER/$REPO_NAME"
    echo "   5. Then run this script again"
    echo ""
    exit 1
fi

echo "✅ GitHub repository connected"
echo ""

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com --project=$PROJECT_ID
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable containerregistry.googleapis.com --project=$PROJECT_ID
echo "✅ APIs enabled"
echo ""

# Grant Cloud Build permissions
echo "🔐 Granting Cloud Build permissions..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet 2>/dev/null || echo "  (Role already granted)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --condition=None \
  --quiet 2>/dev/null || echo "  (Role already granted)"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/storage.admin" \
  --condition=None \
  --quiet 2>/dev/null || echo "  (Role already granted)"

echo "✅ Permissions granted"
echo ""

# Create backend trigger
echo "🔨 Creating backend trigger..."
gcloud builds triggers create github \
  --name="deploy-backend" \
  --repo-name="$REPO_NAME" \
  --repo-owner="$REPO_OWNER" \
  --branch-pattern="^$BRANCH$" \
  --build-config="backend/cloudbuild.yaml" \
  --project=$PROJECT_ID \
  --quiet 2>&1 | grep -v "already exists" || echo "  ✅ Backend trigger created (or already exists)"
echo ""

# Create frontend trigger
echo "🔨 Creating frontend trigger..."
gcloud builds triggers create github \
  --name="deploy-frontend" \
  --repo-name="$REPO_NAME" \
  --repo-owner="$REPO_OWNER" \
  --branch-pattern="^$BRANCH$" \
  --build-config="frontend/cloudbuild.yaml" \
  --project=$PROJECT_ID \
  --quiet 2>&1 | grep -v "already exists" || echo "  ✅ Frontend trigger created (or already exists)"
echo ""

# Create admin trigger
echo "🔨 Creating admin trigger..."
gcloud builds triggers create github \
  --name="deploy-admin" \
  --repo-name="$REPO_NAME" \
  --repo-owner="$REPO_OWNER" \
  --branch-pattern="^$BRANCH$" \
  --build-config="admin-frontend/cloudbuild.yaml" \
  --project=$PROJECT_ID \
  --quiet 2>&1 | grep -v "already exists" || echo "  ✅ Admin trigger created (or already exists)"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "✅ Cloud Build triggers created successfully!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Triggers created:"
echo "   - deploy-backend (backend/cloudbuild.yaml)"
echo "   - deploy-frontend (frontend/cloudbuild.yaml)"
echo "   - deploy-admin (admin-frontend/cloudbuild.yaml)"
echo ""
echo "🚀 Next steps:"
echo ""
echo "1. Ensure DATABASE_URL is set in Cloud Run:"
echo "   gcloud run services update dialadrink-backend \\"
echo "     --region=$REGION \\"
echo "     --project=$PROJECT_ID \\"
echo "     --update-env-vars DATABASE_URL='your-database-url'"
echo ""
echo "2. Test deployment:"
echo "   git commit --allow-empty -m 'test: Trigger Cloud Build'"
echo "   git push origin main"
echo ""
echo "3. Monitor builds:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""

