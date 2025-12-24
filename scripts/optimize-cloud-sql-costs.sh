#!/bin/bash
# Quick script to optimize existing Cloud SQL instance costs
# This script can be run on the existing instance without migration

set -e

PROJECT_ID="drink-suite"
REGION="us-central1"
INSTANCE_NAME="drink-suite-db"

echo "💰 Optimizing Cloud SQL costs for: $INSTANCE_NAME"
echo ""

# Step 1: Check current instance configuration
echo "Step 1: Checking current instance configuration..."
CURRENT_TIER=$(gcloud sql instances describe $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --format="value(settings.tier)")

echo "Current tier: $CURRENT_TIER"

# Step 2: Recommend tier downgrade if applicable
echo ""
echo "Step 2: Analyzing tier options..."
echo ""
echo "Available cost-optimized tiers:"
echo "  - db-f1-micro: Shared CPU, 0.6GB RAM (~\$7/month)"
echo "  - db-g1-small: Shared CPU, 1.7GB RAM (~\$15/month)"
echo "  - db-n1-standard-1: 1 vCPU, 3.75GB RAM (~\$50/month)"
echo ""

read -p "Do you want to downgrade to db-f1-micro? (y/n): " DOWNGRADE

if [ "$DOWNGRADE" = "y" ]; then
  echo ""
  echo "⚠️  WARNING: Downgrading will cause brief downtime (~2-5 minutes)"
  read -p "Continue? (y/n): " CONFIRM
  
  if [ "$CONFIRM" = "y" ]; then
    echo ""
    echo "Downgrading instance tier..."
    gcloud sql instances patch $INSTANCE_NAME \
      --tier=db-f1-micro \
      --project=$PROJECT_ID \
      --quiet
    
    echo "✅ Instance tier downgraded to db-f1-micro"
  fi
fi

# Step 3: Optimize connection settings
echo ""
echo "Step 3: Optimizing connection pool settings..."
echo ""
echo "Current connection pool settings in backend/config.js:"
echo "  - max: 10 connections"
echo "  - min: 2 connections"
echo ""
echo "For db-f1-micro, recommended settings:"
echo "  - max: 5 connections"
echo "  - min: 1 connection"
echo ""

# Step 4: Enable storage auto-increase (if not already enabled)
echo ""
echo "Step 4: Checking storage auto-increase..."
AUTO_INCREASE=$(gcloud sql instances describe $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --format="value(settings.storageAutoResize)")

if [ "$AUTO_INCREASE" != "True" ]; then
  echo "Enabling storage auto-increase..."
  gcloud sql instances patch $INSTANCE_NAME \
    --storage-auto-increase \
    --project=$PROJECT_ID \
    --quiet
  echo "✅ Storage auto-increase enabled"
else
  echo "✅ Storage auto-increase already enabled"
fi

# Step 5: Review backup settings
echo ""
echo "Step 5: Reviewing backup settings..."
BACKUP_ENABLED=$(gcloud sql instances describe $INSTANCE_NAME \
  --project=$PROJECT_ID \
  --format="value(settings.backupConfiguration.enabled)")

if [ "$BACKUP_ENABLED" = "True" ]; then
  BACKUP_COUNT=$(gcloud sql backups list \
    --instance=$INSTANCE_NAME \
    --project=$PROJECT_ID \
    --format="value(id)" | wc -l)
  
  echo "Current backups: $BACKUP_COUNT"
  echo ""
  echo "💡 Tip: Consider reducing backup retention if you have many backups"
  echo "   This can reduce storage costs"
fi

# Step 6: Summary and recommendations
echo ""
echo "✅ Cost optimization review completed!"
echo ""
echo "📊 Estimated Monthly Costs:"
echo "  Current tier ($CURRENT_TIER): ~\$50-200/month"
echo "  Optimized (db-f1-micro): ~\$7-15/month"
echo "  With scheduled stop/start: ~\$5-10/month"
echo ""
echo "🎯 Next Steps:"
echo "  1. Run: ./scripts/setup-auto-pause.sh (for scheduled stop/start)"
echo "  2. Update backend/config.js connection pool settings"
echo "  3. Monitor instance performance after changes"
echo "  4. Consider migrating to new optimized instance if needed"




