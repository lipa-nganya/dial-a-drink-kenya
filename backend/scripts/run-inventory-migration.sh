#!/bin/bash
# Helper script to run inventory migration from old Cloud SQL to new Cloud SQL

set -e

echo "🚀 Inventory Migration Helper"
echo "=============================="
echo ""

# Source database (old)
SOURCE_PROJECT="drink-suite"
SOURCE_INSTANCE="drink-suite-db"
SOURCE_DB="dialadrink"
SOURCE_USER="dialadrink_app"
SOURCE_IP="136.111.27.173"

# Target database (new)
TARGET_PROJECT="dialadrink-production"
TARGET_INSTANCE="dialadrink-db-prod"
TARGET_DB="dialadrink_prod"
TARGET_USER="dialadrink_app"
TARGET_IP="35.223.10.1"

echo "📋 Migration Configuration:"
echo "   Source: $SOURCE_PROJECT / $SOURCE_INSTANCE"
echo "   Target: $TARGET_PROJECT / $TARGET_INSTANCE"
echo ""

# Get source database password
echo "Enter source database password for user '$SOURCE_USER':"
read -s SOURCE_PASSWORD
echo ""

# Get target database password
echo "Enter target database password for user '$TARGET_USER':"
read -s TARGET_PASSWORD
echo ""

# Construct database URLs
SOURCE_DATABASE_URL="postgresql://${SOURCE_USER}:${SOURCE_PASSWORD}@${SOURCE_IP}:5432/${SOURCE_DB}?sslmode=require"
TARGET_DATABASE_URL="postgresql://${TARGET_USER}:${TARGET_PASSWORD}@${TARGET_IP}:5432/${TARGET_DB}?sslmode=require"

echo "🔌 Testing connections..."
echo ""

# Test source connection
echo "Testing source database connection..."
if psql "$SOURCE_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Source database connection successful"
else
  echo "❌ Source database connection failed"
  echo "   Make sure the IP address is whitelisted and password is correct"
  exit 1
fi

# Test target connection
echo "Testing target database connection..."
if psql "$TARGET_DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Target database connection successful"
else
  echo "❌ Target database connection failed"
  echo "   Make sure the IP address is whitelisted and password is correct"
  exit 1
fi

echo ""
echo "🚀 Starting migration..."
echo ""

# Run migration script
cd "$(dirname "$0")/.."
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" \
TARGET_DATABASE_URL="$TARGET_DATABASE_URL" \
node scripts/migrate-inventory-to-production.js

echo ""
echo "✅ Migration complete!"
