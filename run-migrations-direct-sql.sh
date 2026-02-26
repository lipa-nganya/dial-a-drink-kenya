#!/bin/bash
# Run migrations directly via gcloud sql

set -e

PROJECT_ID="dialadrink-production"
INSTANCE_NAME="dialadrink-db-dev"
DATABASE_NAME="dialadrink_dev"
DB_USER="dialadrink_app"

echo "🚀 Running Database Migrations (Direct SQL)"
echo "=========================================="
echo ""

# Set project
gcloud config set project "$PROJECT_ID" 2>&1

echo "📝 Running migrations on $INSTANCE_NAME..."
echo ""

# Add slug column to drinks table if it doesn't exist
echo "1. Adding slug column to drinks table..."
gcloud sql connect "$INSTANCE_NAME" \
    --user="$DB_USER" \
    --database="$DATABASE_NAME" \
    --project="$PROJECT_ID" \
    --quiet << 'SQL'
-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drinks' AND column_name = 'slug'
    ) THEN
        ALTER TABLE drinks ADD COLUMN slug VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS drinks_slug_idx ON drinks(slug);
        RAISE NOTICE 'Added slug column to drinks table';
    ELSE
        RAISE NOTICE 'slug column already exists in drinks table';
    END IF;
END $$;
SQL

echo ""

# Add slug column to categories table if it doesn't exist
echo "2. Adding slug column to categories table..."
gcloud sql connect "$INSTANCE_NAME" \
    --user="$DB_USER" \
    --database="$DATABASE_NAME" \
    --project="$PROJECT_ID" \
    --quiet << 'SQL'
-- Check if column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'slug'
    ) THEN
        ALTER TABLE categories ADD COLUMN slug VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug);
        RAISE NOTICE 'Added slug column to categories table';
    ELSE
        RAISE NOTICE 'slug column already exists in categories table';
    END IF;
END $$;
SQL

echo ""
echo "✅ Migrations completed!"
echo ""
