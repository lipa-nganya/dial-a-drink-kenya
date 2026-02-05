#!/bin/bash
# Run Database Migrations on Production
# This script runs all necessary migrations on the production database

set -e

# Load production configuration
if [ -f "../../production-config.env" ]; then
    source ../../production-config.env
else
    echo "❌ Error: production-config.env not found"
    echo "   Please run ./setup-production.sh first"
    exit 1
fi

echo "🚀 Running Production Database Migrations"
echo "=========================================="
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Database: $INSTANCE_NAME"
echo "   Database Name: $DB_NAME"
echo ""

# Set project
gcloud config set project "$PROJECT_ID"

# Check if using Cloud SQL Proxy or direct connection
if echo "$DATABASE_URL" | grep -q "/cloudsql/"; then
    echo "ℹ️  Using Cloud SQL Unix socket connection"
    echo "   This requires running from Cloud Run or with Cloud SQL Proxy"
    echo ""
    echo "   Option 1: Run via Cloud Run Job (recommended)"
    echo "   Option 2: Use Cloud SQL Proxy locally"
    echo ""
    read -p "   Continue with Cloud SQL Proxy? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Creating Cloud Run Job for migrations..."
        
        # Create a Cloud Run Job for migrations
        gcloud run jobs create migration-job \
            --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
            --region "$REGION" \
            --set-env-vars "NODE_ENV=production" \
            --set-env-vars "DATABASE_URL=$DATABASE_URL" \
            --set-env-vars "RUN_MIGRATIONS=true" \
            --add-cloudsql-instances "$CONNECTION_NAME" \
            --max-retries 1 \
            --task-timeout 600 \
            --project "$PROJECT_ID" 2>/dev/null || {
            echo "   Job may already exist, updating..."
            gcloud run jobs update migration-job \
                --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
                --region "$REGION" \
                --set-env-vars "NODE_ENV=production" \
                --set-env-vars "DATABASE_URL=$DATABASE_URL" \
                --set-env-vars "RUN_MIGRATIONS=true" \
                --add-cloudsql-instances "$CONNECTION_NAME" \
                --max-retries 1 \
                --task-timeout 600 \
                --project "$PROJECT_ID"
        }
        
        echo "   Executing migration job..."
        gcloud run jobs execute migration-job \
            --region "$REGION" \
            --project "$PROJECT_ID" \
            --wait
        
        echo ""
        echo "✅ Migrations completed via Cloud Run Job"
        exit 0
    fi
    
    # Use Cloud SQL Proxy
    echo "   Starting Cloud SQL Proxy..."
    cloud_sql_proxy -instances="$CONNECTION_NAME=tcp:5432" &
    PROXY_PID=$!
    sleep 3
    
    # Update DATABASE_URL to use localhost
    LOCAL_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
    export DATABASE_URL="$LOCAL_DATABASE_URL"
    
    # Cleanup function
    cleanup() {
        kill $PROXY_PID 2>/dev/null || true
    }
    trap cleanup EXIT
else
    echo "ℹ️  Using direct database connection"
fi

# Run migrations using Node.js script
echo ""
echo "📦 Running migrations..."
cd "$(dirname "$0")/.."

NODE_ENV=production NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/add-cash-at-hand-column.js

# Run other migrations if needed
echo ""
echo "📋 Checking for other pending migrations..."

# You can add more migration scripts here
# Example:
# node scripts/run-other-migration.js

echo ""
echo "✅ All migrations completed successfully!"
