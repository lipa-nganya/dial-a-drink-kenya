#!/bin/bash

# Script to migrate brands to production backend database
# This script will connect to the production backend's database and migrate brands

set -e

echo "🚀 Brands Migration to Production Backend"
echo "=========================================="
echo ""

# Production backend URL
PROD_BACKEND="https://deliveryos-backend-p6bkgryxqa-uc.a.run.app"

echo "📊 Checking production backend brands..."
BRANDS_COUNT=$(curl -s "${PROD_BACKEND}/api/brands/all" | grep -o '"id"' | wc -l | tr -d ' ')
echo "   Current brands in production: ${BRANDS_COUNT}"
echo ""

if [ "$BRANDS_COUNT" -gt "0" ]; then
  echo "✅ Production backend already has ${BRANDS_COUNT} brands"
  echo "   If brands are still not showing, the issue might be:"
  echo "   1. Frontend caching"
  echo "   2. Backend database connection issue"
  echo "   3. Brands marked as inactive"
  exit 0
fi

echo "⚠️  Production backend has no brands!"
echo ""
echo "To migrate brands to production, you need to:"
echo ""
echo "Option 1: Update Production Backend DATABASE_URL to Cloud SQL"
echo "-------------------------------------------------------------"
echo "1. Go to Google Cloud Console"
echo "2. Navigate to Cloud Run → deliveryos-backend service"
echo "3. Edit the service"
echo "4. Go to 'Variables & Secrets' tab"
echo "5. Update DATABASE_URL to:"
echo "   postgres://dialadrink_app:q1FiFlzP4kXdUyNQHHrRR7e1w9sF6MS@136.111.27.173:5432/dialadrink?sslmode=require"
echo "6. Save and redeploy"
echo ""
echo "Option 2: Run Migration on Production Database"
echo "------------------------------------------------"
echo "If production backend uses a different database, you need to:"
echo "1. Get the production DATABASE_URL from Cloud Run environment variables"
echo "2. Run the migration script with that DATABASE_URL:"
echo "   DATABASE_URL=\"[production-db-url]\" node backend/scripts/migrate-brands-to-cloud-sql.js"
echo ""
echo "Option 3: Check if Production Backend is Using Cloud SQL"
echo "--------------------------------------------------------"
echo "The production backend might already be connected to Cloud SQL but"
echo "the brands table might not exist. Check the backend logs in Cloud Run."
echo ""



