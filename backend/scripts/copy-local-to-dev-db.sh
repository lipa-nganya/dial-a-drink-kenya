#!/bin/bash
# Copy ALL data from local Postgres (dialadrink) to Cloud SQL dev database (dialadrink_dev)
# WARNING: This copies DATA ONLY (no schema) and will insert into existing tables.
#          It does NOT touch your local database.

set -e

LOCAL_DB="dialadrink"
LOCAL_USER="maria"
LOCAL_HOST="localhost"

DEV_HOST="34.41.187.250"   # dialadrink-db-dev public IP
DEV_DB="dialadrink_dev"
DEV_USER="dialadrink_app"
DEV_PASSWORD="o61yqm5fLiTwWnk5"

echo "🚀 Copying data from local database to development Cloud SQL database..."
echo ""
echo "Local source:      ${LOCAL_USER}@${LOCAL_HOST}/${LOCAL_DB}"
echo "Development target: ${DEV_USER}@${DEV_HOST}/${DEV_DB}"
echo ""

read -p "Are you sure you want to copy ALL data from local to dev? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "❌ Aborted. No changes made."
  exit 1
fi

export PGPASSWORD="$DEV_PASSWORD"

echo "🔄 Copying data (this may take a few minutes)..."

pg_dump \
  -h "$LOCAL_HOST" \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  --data-only \
  --no-owner \
  --no-privileges \
  | psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require"

unset PGPASSWORD

echo ""
echo "✅ Data copy complete!"
echo ""
echo "🔍 Verifying row counts (on dev database)..."

export PGPASSWORD="$DEV_PASSWORD"
psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" << 'SQL'
SELECT 'categories' AS table, COUNT(*) AS rows FROM categories
UNION ALL
SELECT 'subcategories' AS table, COUNT(*) AS rows FROM subcategories
UNION ALL
SELECT 'brands' AS table, COUNT(*) AS rows FROM brands
UNION ALL
SELECT 'drinks' AS table, COUNT(*) AS rows FROM drinks
UNION ALL
SELECT 'users' AS table, COUNT(*) AS rows FROM "Users"
UNION ALL
SELECT 'orders' AS table, COUNT(*) AS rows FROM "Orders";
SQL
unset PGPASSWORD

echo ""
echo "✅ Verification query executed on dev database."
echo "   Compare with local if needed using psql on localhost."
