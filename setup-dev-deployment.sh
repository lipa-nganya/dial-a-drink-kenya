#!/bin/bash
# Setup development deployment from develop branch
# This script configures Cloud Build triggers and documents Netlify setup

set -e

PROJECT_ID="dialadrink-production"
REPO_OWNER="lipanganya"
REPO_NAME="dial-a-drink-kenya"
REGION="us-central1"

echo "🔧 Setting up Development Deployment from develop branch"
echo "========================================================"
echo ""

# Check if trigger already exists
EXISTING_TRIGGER=$(gcloud builds triggers list \
  --project $PROJECT_ID \
  --filter="name:deploy-development-backend" \
  --format="get(name)" 2>/dev/null || echo "")

if [ -n "$EXISTING_TRIGGER" ]; then
  echo "✅ Cloud Build trigger 'deploy-development-backend' already exists"
  echo "   Updating trigger..."
  
  gcloud builds triggers update deploy-development-backend \
    --repo-name=$REPO_NAME \
    --repo-owner=$REPO_OWNER \
    --branch-pattern="^develop$" \
    --build-config="backend/cloudbuild.yaml" \
    --project=$PROJECT_ID \
    2>&1 | tail -5
else
  echo "📦 Creating Cloud Build trigger for develop branch..."
  
  gcloud builds triggers create github \
    --name="deploy-development-backend" \
    --repo-name=$REPO_NAME \
    --repo-owner=$REPO_OWNER \
    --branch-pattern="^develop$" \
    --build-config="backend/cloudbuild.yaml" \
    --project=$PROJECT_ID \
    2>&1 | tail -10
fi

echo ""
echo "✅ Cloud Build trigger configured"
echo ""
echo "📋 Next Steps (Manual):"
echo "======================="
echo ""
echo "1. Netlify Configuration:"
echo "   - Customer site (dialadrink.thewolfgang.tech):"
echo "     → Site settings → Build & deploy → Branch: develop"
echo ""
echo "   - Admin site (dialadrink-admin.thewolfgang.tech):"
echo "     → Site settings → Build & deploy → Branch: develop"
echo ""
echo "2. Verify GitHub Repository:"
echo "   - Repository: $REPO_OWNER/$REPO_NAME"
echo "   - Branch: develop"
echo "   - Account: lipanganya@gmail.com"
echo ""
echo "3. Test Deployment:"
echo "   - Push a commit to develop branch"
echo "   - Check Netlify deploys automatically"
echo "   - Check Cloud Build triggers backend deployment"
echo ""
echo "✅ Setup complete!"
