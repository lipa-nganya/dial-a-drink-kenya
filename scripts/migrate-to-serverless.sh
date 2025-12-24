#!/bin/bash
# Migration script to move from Cloud SQL Standard to Cost-Optimized Setup
# This script creates a smaller instance and migrates data

set -e

# Configuration
PROJECT_ID="drink-suite"
REGION="us-central1"
OLD_INSTANCE="drink-suite-db"
NEW_INSTANCE="drink-suite-db-optimized"
DB_NAME="dialadrink"
DB_USER="dialadrink_app"
BACKUP_BUCKET="gs://${PROJECT_ID}-sql-backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Cloud SQL Migration to Cost-Optimized Setup${NC}"
echo ""

# Step 1: Create backup bucket if it doesn't exist
echo -e "${YELLOW}Step 1: Creating backup bucket...${NC}"
if ! gsutil ls -b $BACKUP_BUCKET &>/dev/null; then
  gsutil mb -p $PROJECT_ID -l $REGION $BACKUP_BUCKET
  echo -e "${GREEN}✅ Backup bucket created${NC}"
else
  echo -e "${GREEN}✅ Backup bucket already exists${NC}"
fi

# Step 2: Create backup of current instance
echo ""
echo -e "${YELLOW}Step 2: Creating backup of current instance...${NC}"
BACKUP_ID="${OLD_INSTANCE}-backup-$(date +%Y%m%d-%H%M%S)"
gcloud sql backups create \
  --instance=$OLD_INSTANCE \
  --project=$PROJECT_ID \
  --async

echo -e "${GREEN}✅ Backup initiated: $BACKUP_ID${NC}"
echo -e "${YELLOW}⏳ Waiting for backup to complete...${NC}"
sleep 30

# Step 3: Export database to SQL file
echo ""
echo -e "${YELLOW}Step 3: Exporting database to SQL file...${NC}"
EXPORT_FILE="${BACKUP_BUCKET}/${DB_NAME}-export-$(date +%Y%m%d-%H%M%S).sql"

# Get the database password from Secret Manager or prompt
if [ -z "$DB_PASSWORD" ]; then
  echo -e "${YELLOW}Enter database password for $DB_USER:${NC}"
  read -s DB_PASSWORD
fi

# Export using pg_dump via Cloud SQL Proxy or direct connection
# Note: This requires Cloud SQL Proxy or authorized network access
echo -e "${YELLOW}Exporting database...${NC}"
# Using gcloud sql export
gcloud sql export sql $OLD_INSTANCE $EXPORT_FILE \
  --database=$DB_NAME \
  --project=$PROJECT_ID

echo -e "${GREEN}✅ Database exported to: $EXPORT_FILE${NC}"

# Step 4: Create new optimized instance (smaller tier)
echo ""
echo -e "${YELLOW}Step 4: Creating new cost-optimized instance...${NC}"
gcloud sql instances create $NEW_INSTANCE \
  --project=$PROJECT_ID \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4 \
  --database-flags=max_connections=25 \
  --deletion-protection=false

echo -e "${GREEN}✅ New instance created: $NEW_INSTANCE${NC}"

# Step 5: Create database and user on new instance
echo ""
echo -e "${YELLOW}Step 5: Creating database and user on new instance...${NC}"
gcloud sql databases create $DB_NAME \
  --instance=$NEW_INSTANCE \
  --project=$PROJECT_ID

# Set password for user
gcloud sql users set-password $DB_USER \
  --instance=$NEW_INSTANCE \
  --project=$PROJECT_ID \
  --password=$DB_PASSWORD

echo -e "${GREEN}✅ Database and user created${NC}"

# Step 6: Import data to new instance
echo ""
echo -e "${YELLOW}Step 6: Importing data to new instance...${NC}"
gcloud sql import sql $NEW_INSTANCE $EXPORT_FILE \
  --database=$DB_NAME \
  --project=$PROJECT_ID

echo -e "${GREEN}✅ Data imported successfully${NC}"

# Step 7: Get new connection name
NEW_CONNECTION_NAME=$(gcloud sql instances describe $NEW_INSTANCE \
  --project=$PROJECT_ID \
  --format="value(connectionName)")

echo ""
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Update DATABASE_URL in Cloud Run:"
echo "   postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${NEW_CONNECTION_NAME}"
echo ""
echo "2. Update Cloud Run service:"
echo "   gcloud run services update dialadrink-backend \\"
echo "     --region=$REGION \\"
echo "     --project=$PROJECT_ID \\"
echo "     --update-env-vars \"DATABASE_URL=postgresql://${DB_USER}:***@/${DB_NAME}?host=/cloudsql/${NEW_CONNECTION_NAME}\" \\"
echo "     --add-cloudsql-instances=$NEW_CONNECTION_NAME"
echo ""
echo "3. Test the application thoroughly"
echo ""
echo "4. After 7 days of successful operation, delete old instance:"
echo "   gcloud sql instances delete $OLD_INSTANCE --project=$PROJECT_ID"
echo ""
echo -e "${RED}⚠️  Keep the old instance for at least 7 days before deletion!${NC}"




