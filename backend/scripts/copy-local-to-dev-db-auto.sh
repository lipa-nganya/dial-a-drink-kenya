#!/bin/bash
# Copy ALL data from local Postgres to Cloud SQL dev database (AUTO-RUN version)

set -e

LOCAL_DB="dialadrink"
LOCAL_USER="maria"
LOCAL_HOST="localhost"

DEV_HOST="34.41.187.250"
DEV_DB="dialadrink_dev"
DEV_USER="dialadrink_app"
DEV_PASSWORD="o61yqm5fLiTwWnk5"

echo "🚀 Copying data from local database to development Cloud SQL database..."
echo ""
echo "Local source:      ${LOCAL_USER}@${LOCAL_HOST}/${LOCAL_DB}"
echo "Development target: ${DEV_USER}@${DEV_HOST}/${DEV_DB}"
echo ""

export PGPASSWORD="$DEV_PASSWORD"

echo "🔄 Copying data (this may take a few minutes)..."

pg_dump \
  -h "$LOCAL_HOST" \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  --data-only \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-acl \
  2>&1 | psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" 2>&1

unset PGPASSWORD

echo ""
echo "✅ Data copy complete!"
echo ""
echo "🔍 Verifying row counts (on dev database)..."

export PGPASSWORD="$DEV_PASSWORD"
psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" << 'SQL'
SELECT 'categories' AS table_name, COUNT(*) AS rows FROM categories
UNION ALL
SELECT 'subcategories', COUNT(*) FROM subcategories
UNION ALL
SELECT 'brands', COUNT(*) FROM brands
UNION ALL
SELECT 'drinks', COUNT(*) FROM drinks
UNION ALL
SELECT 'users', COUNT(*) FROM "Users"
UNION ALL
SELECT 'orders', COUNT(*) FROM "Orders"
ORDER BY table_name;
SQL
unset PGPASSWORD

echo ""
echo "✅ Migration complete!"
