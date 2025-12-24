#!/bin/bash
# Quick cost optimization: Downgrade existing instance and optimize settings
# This is the fastest way to reduce costs without full migration

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
INSTANCE_NAME="drink-suite-db"
SERVICE_NAME="dialadrink-backend"

echo "💰 Quick Cloud SQL Cost Optimization"
echo "======================================"
echo ""
echo "This script will:"
echo "  1. Downgrade instance to db-f1-micro (smallest tier)"
echo "  2. Optimize connection pool settings"
echo "  3. Enable storage auto-increase"
echo ""
echo "⚠️  WARNING: This will cause brief downtime (~2-5 minutes)"
echo ""
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "Cancelled."
  exit 0
fi

# Step 1: Create backup
echo ""
echo "Step 1: Creating backup..."
gcloud sql backups create \
  --instance=$INSTANCE_NAME \
  --project=$PROJECT_ID \
  --async

echo "✅ Backup initiated"
sleep 10

# Step 2: Downgrade instance tier
echo ""
echo "Step 2: Downgrading instance to db-f1-micro..."
gcloud sql instances patch $INSTANCE_NAME \
  --tier=db-f1-micro \
  --project=$PROJECT_ID

echo "✅ Instance downgraded"

# Step 3: Optimize database flags for smaller instance
echo ""
echo "Step 3: Optimizing database settings..."
gcloud sql instances patch $INSTANCE_NAME \
  --database-flags=max_connections=25 \
  --project=$PROJECT_ID

echo "✅ Database settings optimized"

# Step 4: Enable storage auto-increase
echo ""
echo "Step 4: Enabling storage auto-increase..."
gcloud sql instances patch $INSTANCE_NAME \
  --storage-auto-increase \
  --project=$PROJECT_ID

echo "✅ Storage auto-increase enabled"

# Step 5: Update Cloud Run environment variables for optimized connection pool
echo ""
echo "Step 5: Updating Cloud Run connection pool settings..."
gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --update-env-vars "DB_POOL_MAX=5,DB_POOL_MIN=1" \
  --quiet

echo "✅ Connection pool optimized"

echo ""
echo "✅ Cost optimization completed!"
echo ""
echo "📊 Estimated Cost Reduction:"
echo "  Before: ~\$50-200/month (depending on tier)"
echo "  After:  ~\$7-15/month (db-f1-micro)"
echo "  Savings: ~70-90%"
echo ""
echo "💡 Next Steps:"
echo "  1. Monitor application performance"
echo "  2. Consider setting up scheduled stop/start: ./scripts/setup-auto-pause.sh"
echo "  3. Monitor Cloud SQL metrics in GCP Console"




