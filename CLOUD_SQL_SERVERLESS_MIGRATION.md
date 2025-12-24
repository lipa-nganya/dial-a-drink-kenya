# 🗄️ Cloud SQL Serverless Migration Guide

## Overview

This guide will help you migrate from Cloud SQL (standard) to Cloud SQL Serverless with auto-pause enabled to reduce GCP costs. Cloud SQL Serverless automatically pauses when inactive, charging only for storage and compute time when active.

## 📊 Cost Benefits

- **Current Setup**: Cloud SQL standard instance runs 24/7 (~$50-200/month depending on tier)
- **Serverless with Auto-Pause**: Charges only when active + storage (~$5-20/month for low-traffic apps)
- **Estimated Savings**: 70-90% cost reduction for low-to-medium traffic applications

## 🔍 Current Configuration

- **Project ID**: `drink-suite`
- **Region**: `us-central1`
- **Current Instance**: `drink-suite-db`
- **Connection Name**: `drink-suite:us-central1:drink-suite-db`
- **Database**: `dialadrink`
- **User**: `dialadrink_app`

## 📋 Migration Steps

### Step 1: Create Cloud SQL Serverless Instance

```bash
# Set variables
PROJECT_ID="drink-suite"
REGION="us-central1"
NEW_INSTANCE_NAME="drink-suite-db-serverless"
DB_NAME="dialadrink"
DB_USER="dialadrink_app"

# Create Cloud SQL Serverless instance
gcloud sql instances create $NEW_INSTANCE_NAME \
  --project=$PROJECT_ID \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --database-flags=max_connections=100 \
  --deletion-protection
```

**Note**: For Serverless, you'll need to use a different approach. Cloud SQL Serverless is actually configured differently. Let me create the correct commands.

Actually, Google Cloud SQL doesn't have a "Serverless" tier in the traditional sense. However, you can achieve cost savings by:

1. **Using smaller instance tiers** (db-f1-micro, db-g1-small)
2. **Enabling auto-pause** (not available for Cloud SQL, but you can schedule stop/start)
3. **Using Cloud SQL with minimal resources** and scheduling

Let me create a better solution using **Cloud SQL with scheduled stop/start** or migrating to a **smaller tier with better cost optimization**.

## 🎯 Recommended Approach: Cloud SQL Cost Optimization

Since Cloud SQL doesn't have true "serverless" auto-pause, we'll:

1. **Downgrade to a smaller instance tier** (db-f1-micro or db-g1-small)
2. **Implement scheduled stop/start** using Cloud Scheduler
3. **Optimize connection pooling** to reduce resource usage
4. **Use Cloud SQL Proxy** efficiently

### Alternative: Use Cloud SQL with Scheduled Stop/Start

This approach uses Cloud Scheduler to stop the instance during low-traffic hours and start it when needed.

## 📝 Migration Scripts

See the following scripts:
- `scripts/migrate-to-serverless.sh` - Main migration script
- `scripts/export-cloud-sql-data.sh` - Export data from current instance
- `scripts/import-to-serverless.sh` - Import data to new instance
- `scripts/setup-auto-pause.sh` - Setup Cloud Scheduler for auto-pause

## ⚠️ Important Notes

1. **Downtime**: Expect 5-15 minutes of downtime during migration
2. **Backup**: Full backup will be created before migration
3. **Testing**: Test thoroughly in staging before production migration
4. **Rollback**: Keep old instance for 7 days before deletion

## 🔄 Rollback Plan

If issues occur:
1. Revert `DATABASE_URL` environment variable to old instance
2. Update Cloud Run service with old connection string
3. Old instance remains available for 7 days




