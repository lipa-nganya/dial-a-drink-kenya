#!/bin/bash

# Script to run database migrations on Cloud SQL
# This script can be run locally with Cloud SQL Proxy or from Cloud Run

set -e

echo "🚀 Cloud SQL Migration Runner"
echo "=============================="
echo ""

# Get DATABASE_URL from Cloud Run service if not set
if [ -z "$DATABASE_URL" ]; then
  echo "📊 Retrieving DATABASE_URL from Cloud Run service..."
  DATABASE_URL=$(gcloud run services describe deliveryos-backend \
    --region us-central1 \
    --format="value(spec.template.spec.containers[0].env)" 2>/dev/null | \
    grep -oP "DATABASE_URL.*?value': '\K[^']*" || echo "")
  
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ Could not retrieve DATABASE_URL from Cloud Run service"
    echo "   Please set DATABASE_URL environment variable manually"
    echo "   Example: export DATABASE_URL='postgres://user:pass@host/db'"
    exit 1
  fi
  
  echo "✅ Retrieved DATABASE_URL from Cloud Run service"
  export DATABASE_URL
fi

# Mask password in URL for logging
MASKED_URL=$(echo "$DATABASE_URL" | sed 's/:\([^:@]*\)@/:***@/')
echo "📊 Using DATABASE_URL: ${MASKED_URL:0:80}..."
echo ""

# Set NODE_ENV if not set
export NODE_ENV=${NODE_ENV:-production}

# Check if using Cloud SQL Unix socket (requires proxy or Cloud Run)
if echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
  echo "ℹ️  Detected Cloud SQL Unix socket connection"
  echo "   This requires either:"
  echo "   1. Running from Cloud Run (automatic)"
  echo "   2. Running locally with Cloud SQL Proxy"
  echo ""
  
  # Check if cloud_sql_proxy is running (for local execution)
  if ! pgrep -f cloud_sql_proxy > /dev/null; then
    echo "⚠️  Cloud SQL Proxy not detected"
    echo "   If running locally, start it with:"
    echo "   cloud_sql_proxy -instances=drink-suite:us-central1:drink-suite-db=tcp:5432 &"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Change to backend directory
cd "$(dirname "$0")/.." || exit 1

# Run migrations
echo "🔌 Running migrations..."
echo ""
node scripts/run-cloud-sql-migrations.js

echo ""
echo "✅ Migration script completed"





