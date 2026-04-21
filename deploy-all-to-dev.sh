#!/bin/bash
# Deploy Backend to Dev Environment
# This script deploys backend only. Frontends are deployed to Netlify (not Cloud Run).

set -e

# Get project root directory (where this script is located)
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

PROJECT_ID="drink-suite"
REGION="us-central1"
BACKEND_SERVICE="deliveryos-backend"
# Note: Frontends are deployed to Netlify, not Cloud Run
# Customer: https://dialadrink.thewolfgang.tech
# Admin: https://dialadrink-admin.thewolfgang.tech

# PesaPal Credentials (Dev)
PESAPAL_CONSUMER_KEY="UDLDp9yShy4g0aLPNhT+2kZSX3L+KdsF"
PESAPAL_CONSUMER_SECRET="XeRwDyreZTPde0H3AWlIiStXZD8="

# M-Pesa Sandbox Credentials (Dev)
MPESA_ENVIRONMENT="sandbox"
MPESA_CONSUMER_KEY="FHZFIBqOrkVQRROotlEhiit3LWycwhsg2GgIxeS1BaE46Ecf"
MPESA_CONSUMER_SECRET="BDosKnRkJOXzY2oIeAMp12g5mQHxjkPCA1k5drdUmrqsd2A9W3APkmgx5ThkLjws"
MPESA_SHORTCODE="174379"
MPESA_PASSKEY="bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"

# Backend URL (maintain existing)
BACKEND_URL="https://deliveryos-backend-p6bkgryxqa-uc.a.run.app"
BACKEND_API_URL="${BACKEND_URL}/api"
MPESA_CALLBACK_URL="${BACKEND_URL}/api/mpesa/callback"

# Frontend URLs (Netlify production)
CUSTOMER_FRONTEND_URL="https://dialadrink.thewolfgang.tech"
ADMIN_FRONTEND_URL="https://dialadrink-admin.thewolfgang.tech"

echo "🚀 Deploying Backend to Dev Environment"
echo "=============================================="
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Backend URL: $BACKEND_URL"
echo ""
echo "📦 Changes Being Deployed:"
echo "   ✅ PesaPal card payment integration"
echo "   ✅ Phone number normalization (254 format)"
echo "   ✅ Customer login persistence (localStorage sync)"
echo "   ✅ Real-time payment status updates (Socket.IO)"
echo "   ✅ Order status auto-update to 'confirmed' on payment"
echo "   ✅ Flexible phone number matching (multiple variants)"
echo "   ✅ Enhanced PIN status check (Orders table fallback)"
echo "   ✅ Pagination in My Orders"
echo "   ✅ Payment finalization improvements"
echo ""

# Set project and region
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

echo "📁 Project root: $PROJECT_ROOT"
echo ""

# ============================================
# 1. Deploy Backend
# ============================================
echo "🔨 Step 1: Deploying Backend..."
echo ""

cd "$PROJECT_ROOT/backend"

# Build and push image
echo "📦 Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE .

# Get existing environment variables to preserve them (CRITICAL for CORS)
echo "📊 Retrieving existing environment variables..."
EXISTING_ENV_RAW=$(gcloud run services describe $BACKEND_SERVICE --format="get(spec.template.spec.containers[0].env)" 2>/dev/null || echo "")

# Extract FRONTEND_URL and ADMIN_URL from existing env vars
EXISTING_FRONTEND_URL=$(echo "$EXISTING_ENV_RAW" | grep -oP "FRONTEND_URL.*?value': '\K[^']*" || echo "")
EXISTING_ADMIN_URL=$(echo "$EXISTING_ENV_RAW" | grep -oP "ADMIN_URL.*?value': '\K[^']*" || echo "")

# Use existing values if they exist, otherwise use defaults (CRITICAL: These are needed for CORS)
FRONTEND_URL_VALUE="${EXISTING_FRONTEND_URL:-https://dialadrink.thewolfgang.tech}"
ADMIN_URL_VALUE="${EXISTING_ADMIN_URL:-https://dialadrink-admin.thewolfgang.tech}"

echo "   FRONTEND_URL: $FRONTEND_URL_VALUE (preserved for CORS)"
echo "   ADMIN_URL: $ADMIN_URL_VALUE (preserved for CORS)"
echo ""

# Deploy with PesaPal and M-Pesa credentials and preserve existing env vars (especially FRONTEND_URL and ADMIN_URL for CORS)
# CRITICAL: Always include FRONTEND_URL and ADMIN_URL to prevent CORS issues after deployment
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $BACKEND_SERVICE \
  --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "NODE_ENV=production,PESAPAL_CONSUMER_KEY=$PESAPAL_CONSUMER_KEY,PESAPAL_CONSUMER_SECRET=$PESAPAL_CONSUMER_SECRET,PESAPAL_ENVIRONMENT=sandbox,CUSTOMER_FRONTEND_URL=$CUSTOMER_FRONTEND_URL,FRONTEND_URL=$FRONTEND_URL_VALUE,ADMIN_URL=$ADMIN_URL_VALUE,MPESA_ENVIRONMENT=$MPESA_ENVIRONMENT,MPESA_CONSUMER_KEY=$MPESA_CONSUMER_KEY,MPESA_CONSUMER_SECRET=$MPESA_CONSUMER_SECRET,MPESA_SHORTCODE=$MPESA_SHORTCODE,MPESA_PASSKEY=$MPESA_PASSKEY,MPESA_CALLBACK_URL=$MPESA_CALLBACK_URL" \
  --add-cloudsql-instances "$PROJECT_ID:$REGION:drink-suite-db"

echo ""
echo "✅ Backend deployed successfully!"
BACKEND_SERVICE_URL=$(gcloud run services describe $BACKEND_SERVICE --format="value(status.url)")
echo "   Service URL: $BACKEND_SERVICE_URL"
echo ""

# ============================================
# 2. Frontend Deployment (SKIPPED - Using Netlify)
# ============================================
echo "🔨 Step 2: Frontend Deployment..."
echo ""
echo "ℹ️  Frontend deployment skipped - using Netlify for production:"
echo "   Customer Site: https://dialadrink.thewolfgang.tech"
echo "   Admin Dashboard: https://dialadrink-admin.thewolfgang.tech"
echo ""
echo "   Frontends are automatically deployed to Netlify via GitHub."
echo "   No Cloud Run frontend services needed."
echo ""

# ============================================
# 3. Driver App Build Instructions
# ============================================
echo "🔨 Step 3: Driver App Build Instructions..."
echo ""
echo "📱 To build the driver app APK for dev:"
echo "   1. Open Android Studio"
echo "   2. Open project: driver-app-native"
echo "   3. Build > Select Build Variant > developmentDebug"
echo "   4. Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo ""
echo "   The app will use API URL: $BACKEND_API_URL"
echo ""

# ============================================
# Summary
# ============================================
echo "═══════════════════════════════════════════════════════"
echo "✅ Backend Deployed Successfully!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "📋 Service URLs:"
echo "   Backend API: $BACKEND_API_URL"
echo "   Customer Site: https://dialadrink.thewolfgang.tech (Netlify)"
echo "   Admin Dashboard: https://dialadrink-admin.thewolfgang.tech (Netlify)"
echo ""
echo "🔐 PesaPal Configuration:"
echo "   Consumer Key: $PESAPAL_CONSUMER_KEY"
echo "   Environment: sandbox"
echo ""
echo "📝 Next Steps:"
echo "   1. Configure PesaPal Dashboard (see below)"
echo "   2. Build driver app APK"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "🔗 PesaPal Dashboard Configuration"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Go to: https://developer.pesapal.com/"
echo "Navigate to: Settings > IPN Settings (Production credentials section)"
echo ""
echo "Website Domain:"
echo "   https://dialadrink.thewolfgang.tech"
echo ""
echo "IPN Listener URL:"
echo "   ${BACKEND_URL}/api/pesapal/ipn"
echo ""
echo "═══════════════════════════════════════════════════════"
