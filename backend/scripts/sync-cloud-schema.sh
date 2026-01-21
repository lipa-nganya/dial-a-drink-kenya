#!/bin/bash

# Script to compare and sync local database schema to Cloud SQL
# This script uses Cloud SQL Proxy or direct connection

set -e

echo "🚀 Cloud SQL Schema Sync"
echo "========================"
echo ""

# Get Cloud SQL DATABASE_URL
if [ -z "$CLOUD_DATABASE_URL" ] && [ -z "$DATABASE_URL" ]; then
  echo "📊 Attempting to retrieve DATABASE_URL from Cloud Run service..."
  CLOUD_DATABASE_URL=$(gcloud run services describe deliveryos-backend \
    --region us-central1 \
    --format="value(spec.template.spec.containers[0].env)" 2>/dev/null | \
    grep -oP "DATABASE_URL.*?value': '\K[^']*" || echo "")
  
  if [ -n "$CLOUD_DATABASE_URL" ]; then
    export CLOUD_DATABASE_URL
    echo "✅ Retrieved DATABASE_URL from Cloud Run service"
  else
    echo "❌ Could not retrieve DATABASE_URL automatically"
    echo ""
    echo "Please set CLOUD_DATABASE_URL or DATABASE_URL:"
    echo "  export CLOUD_DATABASE_URL='postgres://user:password@host/database'"
    echo ""
    echo "Or use Cloud SQL Proxy:"
    echo "  cloud_sql_proxy -instances=drink-suite:us-central1:drink-suite-db=tcp:5432 &"
    echo "  export CLOUD_DATABASE_URL='postgres://user:password@localhost:5432/database'"
    exit 1
  fi
fi

# Mask password for logging
if [ -n "$CLOUD_DATABASE_URL" ]; then
  MASKED_URL=$(echo "$CLOUD_DATABASE_URL" | sed 's/:\([^:@]*\)@/:***@/')
elif [ -n "$DATABASE_URL" ]; then
  MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:\([^:@]*\)@/:***@/')
fi

echo "📊 Cloud Database: ${MASKED_URL:0:80}..."
echo ""

# Check if using Cloud SQL Unix socket (requires proxy)
if echo "$CLOUD_DATABASE_URL" | grep -q "/cloudsql/" || echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
  echo "ℹ️  Detected Cloud SQL Unix socket connection"
  echo "   This requires either:"
  echo "   1. Running from Cloud Run (automatic)"
  echo "   2. Running locally with Cloud SQL Proxy"
  echo ""
fi

# Check if cloud_sql_proxy is running (for TCP connections)
if echo "$CLOUD_DATABASE_URL" | grep -q "localhost:5432" || echo "$DATABASE_URL" | grep -q "localhost:5432"; then
  if ! pgrep -f cloud_sql_proxy > /dev/null; then
    echo "⚠️  Cloud SQL Proxy not detected but localhost:5432 is used"
    echo "   If you need the proxy, start it with:"
    echo "   cloud_sql_proxy -instances=drink-suite:us-central1:drink-suite-db=tcp:5432 &"
    echo ""
  fi
fi

# Ensure we're in the backend directory
cd "$(dirname "$0")/.." || exit 1

# Check if local database is accessible
echo "🔍 Checking local database connection..."
if ! NODE_ENV=development node -e "require('./models').sequelize.authenticate().then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; then
  echo "❌ Could not connect to local database"
  echo "   Please ensure your local PostgreSQL is running and configured in .env.local"
  exit 1
fi
echo "✅ Local database connection verified"
echo ""

# Run the comparison script
echo "🔍 Comparing schemas and applying migrations..."
echo ""

if [ -n "$CLOUD_DATABASE_URL" ]; then
  CLOUD_DATABASE_URL="$CLOUD_DATABASE_URL" node scripts/compare-and-sync-schemas.js
else
  DATABASE_URL="$DATABASE_URL" node scripts/compare-and-sync-schemas.js
fi

echo ""
echo "✅ Schema sync completed!"
