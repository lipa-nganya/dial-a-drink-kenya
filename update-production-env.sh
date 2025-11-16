#!/bin/bash
# Quick script to update critical production environment variables
# Use this to set production-specific values that differ from .env

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
SERVICE_NAME="dialadrink-backend"

echo "🔧 Updating production environment variables..."
echo ""

# Update critical production variables
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-env-vars "DATABASE_URL=postgresql://dialadrink_app:q1FiFlzP4kXdUyNQHHrRR7e1w9sF6MS@/dialadrink?host=/cloudsql/drink-suite:us-central1:drink-suite-db,MPESA_CALLBACK_URL=https://dialadrink-backend-910510650031.us-central1.run.app/api/mpesa/callback,MPESA_ENVIRONMENT=production" \
  --quiet

echo "✅ Production environment variables updated!"
echo ""
echo "📝 Updated variables:"
echo "   - DATABASE_URL (Cloud SQL connection)"
echo "   - MPESA_CALLBACK_URL (Cloud Run URL)"
echo "   - MPESA_ENVIRONMENT (production)"

