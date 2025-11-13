#!/bin/bash
# Script to update Cloud Run with Cloud SQL DATABASE_URL

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
SERVICE_NAME="dialadrink-backend"
INSTANCE_NAME="drink-suite-db"
CONNECTION_NAME="drink-suite:us-central1:drink-suite-db"
DB_USER="dialadrink_app"
DB_NAME="dialadrink"

echo "🔧 Updating Cloud Run service with Cloud SQL connection..."
echo ""

# Check if password is provided as argument
if [ -z "$1" ]; then
    echo "❌ Error: Database password is required"
    echo ""
    echo "Usage: $0 <DATABASE_PASSWORD>"
    echo ""
    echo "Example:"
    echo "  $0 mySecurePassword123"
    echo ""
    echo "Or if you need to reset the password first:"
    echo "  gcloud sql users set-password $DB_USER \\"
    echo "    --instance=$INSTANCE_NAME \\"
    echo "    --project=$PROJECT_ID \\"
    echo "    --password=NEW_PASSWORD"
    exit 1
fi

DB_PASSWORD="$1"

echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo "   Instance: $INSTANCE_NAME"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Construct DATABASE_URL using Unix socket (recommended for Cloud Run)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "🔗 DATABASE_URL format: postgresql://${DB_USER}:***@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""

# Update Cloud Run service
echo "🚀 Updating Cloud Run service..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --add-cloudsql-instances=$CONNECTION_NAME \
  --update-env-vars DATABASE_URL="$DATABASE_URL" \
  --quiet

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait for the new revision to deploy"
echo "   2. Check logs: gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
echo "   3. Test health endpoint: curl https://dialadrink-backend-910510650031.us-central1.run.app/api/health"


