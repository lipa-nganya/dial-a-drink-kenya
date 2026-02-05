#!/bin/bash
# Configure backend service with Cloud SQL database connection

set -e

PROJECT_ID="dialadrink-production"
REGION="us-central1"
SERVICE_NAME="deliveryos-backend"
INSTANCE_NAME="dialadrink-db-prod"
CONNECTION_NAME="dialadrink-production:us-central1:dialadrink-db-prod"
DB_USER="dialadrink_app"
DB_NAME="dialadrink_prod"

echo "🔧 Configuring Backend with Cloud SQL Database"
echo "================================================"
echo ""
echo "📋 Configuration:"
echo "   Project: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Service: $SERVICE_NAME"
echo "   Instance: $INSTANCE_NAME"
echo "   Connection: $CONNECTION_NAME"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
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
    echo "If you don't know the password, you can reset it:"
    echo "  gcloud sql users set-password $DB_USER \\"
    echo "    --instance=$INSTANCE_NAME \\"
    echo "    --project=$PROJECT_ID \\"
    echo "    --password=NEW_PASSWORD"
    echo ""
    exit 1
fi

DB_PASSWORD="$1"

# Construct DATABASE_URL using Unix socket (recommended for Cloud Run)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "🔗 DATABASE_URL: postgresql://${DB_USER}:***@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""

# Set gcloud config
gcloud config set project "$PROJECT_ID"
gcloud config set run/region "$REGION"

# Update Cloud Run service
echo "🚀 Updating Cloud Run service..."
gcloud run services update "$SERVICE_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --update-env-vars "DATABASE_URL=$DATABASE_URL" \
  --quiet

echo ""
echo "✅ Cloud Run service updated successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Wait for the new revision to deploy (30-60 seconds)"
echo "   2. Check logs: gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit 20"
echo "   3. Test health endpoint: curl https://deliveryos-backend-805803410802.us-central1.run.app/api/health"
echo "   4. Test API: curl https://deliveryos-backend-805803410802.us-central1.run.app/api/categories"
echo ""
