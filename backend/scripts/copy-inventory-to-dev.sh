#!/bin/bash
# Copy Inventory Data (categories, subcategories, brands, drinks) from Local to Development
# This script uses pg_dump and psql for direct database-to-database copy

set -e

# Local database config
LOCAL_DB="dialadrink"
LOCAL_USER="maria"
LOCAL_HOST="localhost"
LOCAL_PORT="5432"

# Development database config
DEV_HOST="34.41.187.250"
DEV_DB="dialadrink_dev"
DEV_USER="dialadrink_app"
DEV_PASSWORD="o61yqm5fLiTwWnk5"

echo "🚀 Copying Inventory Data from Local to Development Database"
echo "============================================================"
echo ""
echo "Local source:      ${LOCAL_USER}@${LOCAL_HOST}:${LOCAL_PORT}/${LOCAL_DB}"
echo "Development target: ${DEV_USER}@${DEV_HOST}/${DEV_DB}"
echo ""

export PGPASSWORD="$DEV_PASSWORD"

# Step 1: Clear existing inventory data from development
echo "🗑️  Step 1: Clearing existing inventory data from development..."
psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" << 'SQL'
-- Delete related records first
DELETE FROM inventory_checks;
DELETE FROM order_items;
DELETE FROM cart_items WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items');

-- Delete drinks
DELETE FROM drinks;

-- Delete subcategories
DELETE FROM subcategories;

-- Delete categories
DELETE FROM categories;

-- Delete brands
DELETE FROM brands;

-- Reset sequences
ALTER SEQUENCE IF EXISTS drinks_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS categories_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS subcategories_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS brands_id_seq RESTART WITH 1;
SQL

echo "   ✅ Development database cleared"
echo ""

# Step 2: Export data from local database
echo "📦 Step 2: Exporting data from local database..."
TEMP_DIR=$(mktemp -d)
EXPORT_FILE="$TEMP_DIR/inventory_export.sql"

# Export only the tables we need
pg_dump \
  -h "$LOCAL_HOST" \
  -p "$LOCAL_PORT" \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  --data-only \
  --table=categories \
  --table=subcategories \
  --table=brands \
  --table=drinks \
  --no-owner \
  --no-privileges \
  -f "$EXPORT_FILE" 2>&1

if [ ! -f "$EXPORT_FILE" ] || [ ! -s "$EXPORT_FILE" ]; then
    echo "❌ Export failed or file is empty"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "   ✅ Data exported to temporary file"
echo ""

# Step 3: Import data to development database
echo "📥 Step 3: Importing data to development database..."
psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" < "$EXPORT_FILE" 2>&1 | grep -v "NOTICE:" | grep -v "already exists" || true

echo "   ✅ Data imported"
echo ""

# Clean up
rm -rf "$TEMP_DIR"

# Step 4: Verify counts
echo "🔍 Step 4: Verifying data..."
psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" << 'SQL'
SELECT 
    'categories' AS table_name, COUNT(*) AS rows FROM categories
UNION ALL
SELECT 'subcategories', COUNT(*) FROM subcategories
UNION ALL
SELECT 'brands', COUNT(*) FROM brands
UNION ALL
SELECT 'drinks', COUNT(*) FROM drinks
ORDER BY table_name;
SQL

unset PGPASSWORD

echo ""
echo "✅ Inventory copy complete!"
