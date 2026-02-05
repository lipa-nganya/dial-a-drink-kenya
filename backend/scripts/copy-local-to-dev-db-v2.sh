#!/bin/bash
# Copy data from local to dev database using pg_dump/psql

set -e

LOCAL_DB="dialadrink"
LOCAL_USER="maria"
LOCAL_HOST="localhost"

DEV_HOST="34.41.187.250"
DEV_DB="dialadrink_dev"
DEV_USER="dialadrink_app"
DEV_PASSWORD="o61yqm5fLiTwWnk5"

echo "🚀 Copying data from local to development database..."
echo ""

# First, initialize schema using Node.js (if needed)
echo "📦 Step 1: Initializing schema on dev database..."
cd backend
export DATABASE_URL="postgresql://${DEV_USER}:${DEV_PASSWORD}@${DEV_HOST}:5432/${DEV_DB}?sslmode=require"
NODE_TLS_REJECT_UNAUTHORIZED=0 node -e "
const db = require('./models');
db.sequelize.sync({ force: false, alter: false })
  .then(() => {
    console.log('✅ Schema initialized');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Schema init failed:', err.message);
    process.exit(1);
  });
" || echo "⚠️  Schema init had issues, continuing..."

cd ..

# Now copy data using pg_dump
echo ""
echo "📦 Step 2: Copying data..."
export PGPASSWORD="$DEV_PASSWORD"

# Use COPY format for better compatibility
pg_dump \
  -h "$LOCAL_HOST" \
  -U "$LOCAL_USER" \
  -d "$LOCAL_DB" \
  --data-only \
  --no-owner \
  --no-privileges \
  --no-tablespaces \
  --no-acl \
  --format=plain \
  2>&1 | grep -v "ERROR:" | psql "host=${DEV_HOST} port=5432 dbname=${DEV_DB} user=${DEV_USER} sslmode=require" 2>&1 | grep -v "ERROR:" | tail -20

unset PGPASSWORD

echo ""
echo "✅ Migration complete!"
