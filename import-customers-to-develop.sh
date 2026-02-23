#!/bin/bash

# Script to import customers to development database
# This uses Cloud SQL Proxy to connect locally and run the import

set -e

echo "🚀 Importing customers to development database..."
echo "================================================"

# Configuration
PROJECT_ID="dialadrink-production"
DB_INSTANCE="dialadrink-db-prod"
DB_CONNECTION="${PROJECT_ID}:us-central1:${DB_INSTANCE}"
SQL_FILE="/Users/maria/Documents/dial a drink database.sql"

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found: $SQL_FILE"
    exit 1
fi

echo "📂 SQL file: $SQL_FILE"
echo "🔌 Database: $DB_CONNECTION"
echo ""

# Check if Cloud SQL Proxy is available (in PATH or local directory)
CLOUD_SQL_PROXY=""
if command -v cloud-sql-proxy &> /dev/null; then
    CLOUD_SQL_PROXY="cloud-sql-proxy"
elif [ -f "./cloud-sql-proxy" ]; then
    CLOUD_SQL_PROXY="./cloud-sql-proxy"
else
    echo "❌ Cloud SQL Proxy not found"
    echo "   Downloading Cloud SQL Proxy..."
    curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
    chmod +x cloud-sql-proxy
    CLOUD_SQL_PROXY="./cloud-sql-proxy"
fi

# Check if proxy is already running
if pgrep -f "cloud-sql-proxy.*$DB_CONNECTION" > /dev/null; then
    echo "✅ Cloud SQL Proxy is already running"
    PROXY_RUNNING=true
else
    echo "🚀 Starting Cloud SQL Proxy on port 5433..."
    $CLOUD_SQL_PROXY "$DB_CONNECTION" --port 5433 &
    PROXY_PID=$!
    PROXY_RUNNING=false
    sleep 5
    
    # Check if proxy started successfully
    if ! kill -0 $PROXY_PID 2>/dev/null; then
        echo "❌ Failed to start Cloud SQL Proxy"
        exit 1
    fi
    
    echo "✅ Cloud SQL Proxy started (PID: $PROXY_PID)"
fi

# Cleanup function
cleanup() {
    if [ "$PROXY_RUNNING" = false ] && [ -n "$PROXY_PID" ]; then
        echo ""
        echo "🧹 Stopping Cloud SQL Proxy..."
        kill $PROXY_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Set DATABASE_URL for development (using port 5433 for Cloud SQL Proxy)
export DATABASE_URL="postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@localhost:5433/dialadrink_prod"
export NODE_ENV=production

echo ""
echo "📥 Running customer import..."
echo ""

# Run import
cd backend
node scripts/import-customers-from-sql.js "$SQL_FILE"

echo ""
echo "✅ Customer import completed!"
echo ""
echo "Next steps:"
echo "  1. Verify customers in development admin dashboard"
echo "  2. Test search and pagination functionality"
echo "  3. Check that customer names are displayed correctly"
