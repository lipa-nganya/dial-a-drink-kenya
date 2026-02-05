#!/bin/bash
# Setup Netlify Production Sites
# This script helps configure Netlify production deployments

set -e

echo "🌐 Setting Up Netlify Production Sites"
echo "======================================="
echo ""
echo "📋 Netlify Production Account:"
echo "   Email: dialadrinkkenya254@gmail.com"
echo "   Password: Malibu2026."
echo ""

# Check if netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "⚠️  Netlify CLI not found. Installing..."
    npm install -g netlify-cli
    echo "✅ Netlify CLI installed"
fi

echo "🔐 Step 1: Logging into Netlify..."
echo ""
echo "You will be prompted to log in. Use:"
echo "   Email: dialadrinkkenya254@gmail.com"
echo "   Password: Malibu2026."
echo ""
read -p "Press Enter to continue with Netlify login..."

netlify login

echo ""
echo "✅ Logged into Netlify"
echo ""

# Get backend URL from production config if available
BACKEND_URL=""
if [ -f "production-config.env" ]; then
    source production-config.env
    if [ -n "$SERVICE_URL" ]; then
        BACKEND_URL="$SERVICE_URL"
    fi
fi

if [ -z "$BACKEND_URL" ]; then
    echo "⚠️  Backend URL not found in production-config.env"
    echo "   Please provide the production backend URL:"
    read -p "   Backend URL (e.g., https://dialadrink-backend-prod-xxx.run.app): " BACKEND_URL
fi

BACKEND_API_URL="${BACKEND_URL}/api"

echo ""
echo "📋 Configuration:"
echo "   Backend API URL: $BACKEND_API_URL"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "📝 Next Steps (Manual Setup via Netlify Dashboard)"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "1. Customer Frontend Setup:"
echo "   - Go to: https://app.netlify.com"
echo "   - Click 'Add new site' → 'Import an existing project'"
echo "   - Select 'GitHub' → Authorize"
echo "   - Select repository: dial-a-drink-kenya (or your repo name)"
echo "   - Branch to deploy: main"
echo "   - Base directory: frontend"
echo "   - Build command: npm install && npm run build"
echo "   - Publish directory: frontend/build"
echo "   - Environment variables:"
echo "     REACT_APP_API_URL=$BACKEND_API_URL"
echo "     REACT_APP_ENVIRONMENT=production"
echo ""
echo "2. Admin Frontend Setup:"
echo "   - Go to: https://app.netlify.com"
echo "   - Click 'Add new site' → 'Import an existing project'"
echo "   - Select 'GitHub' → Authorize"
echo "   - Select repository: dial-a-drink-kenya (or your repo name)"
echo "   - Branch to deploy: main"
echo "   - Base directory: admin-frontend"
echo "   - Build command: npm install && npm run build"
echo "   - Publish directory: admin-frontend/build"
echo "   - Environment variables:"
echo "     REACT_APP_API_URL=$BACKEND_API_URL"
echo "     REACT_APP_ENVIRONMENT=production"
echo ""
echo "3. After sites are created, note the URLs and update backend CORS:"
echo "   gcloud run services update dialadrink-backend-prod \\"
echo "     --region us-central1 \\"
echo "     --project dialadrink-production \\"
echo "     --update-env-vars FRONTEND_URL=<CUSTOMER_NETLIFY_URL> \\"
echo "     --update-env-vars ADMIN_URL=<ADMIN_NETLIFY_URL>"
echo ""
echo "📚 See PRODUCTION_SETUP_GUIDE.md for detailed instructions"
echo ""
