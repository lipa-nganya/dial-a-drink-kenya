#!/bin/bash
# Run stop fields migration on development database

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-development-backend"
INSTANCE_NAME="dialadrink-db-dev"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-dev"
DB_NAME="dialadrink_dev"
DB_USER="dialadrink_app"
DB_PASSWORD="o61yqm5fLiTwWnk5"

echo "🔄 Running Stop Fields Migration on Development Database"
echo "========================================================"
echo ""

# Set project
gcloud config set project "$PROJECT_ID"

# Check if Cloud SQL Proxy is available
if command -v cloud_sql_proxy &> /dev/null; then
    echo "📡 Starting Cloud SQL Proxy..."
    cloud_sql_proxy -instances="$CONNECTION_NAME=tcp:5432" &
    PROXY_PID=$!
    sleep 3
    
    # Set DATABASE_URL for local connection
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
    
    # Cleanup function
    cleanup() {
        echo ""
        echo "🛑 Stopping Cloud SQL Proxy..."
        kill $PROXY_PID 2>/dev/null || true
    }
    trap cleanup EXIT
    
    echo "✅ Cloud SQL Proxy started"
    echo ""
else
    echo "⚠️  Cloud SQL Proxy not found"
    echo "   Using Cloud SQL Unix socket connection (requires Cloud Run)"
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
fi

# Set NODE_ENV
export NODE_ENV=development

# Run migration
echo "🚀 Running migration..."
cd backend
node scripts/run-stop-fields-migration.js

echo ""
echo "✅ Migration completed!"
