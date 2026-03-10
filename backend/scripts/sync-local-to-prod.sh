#!/bin/bash
# Sync slugs, tags, and page titles from local DB to production DB.
# Same approach as sync to dev: SOURCE_DATABASE_URL = local, DATABASE_URL = target (prod).
#
# Do not commit credentials. Set env vars before running, or use a gitignored env file.
#
# 1) Start Cloud SQL Proxy for production (in another terminal):
#    cloud_sql_proxy -instances=dialadrink-production:us-central1:dialadrink-db-prod=tcp:5433 &
# 2) Set URLs (prod via proxy example):
#    export SOURCE_DATABASE_URL="postgresql://postgres:password@localhost:5432/dialadrink"
#    export TARGET_DATABASE_URL="postgresql://dialadrink_app:YOUR_PROD_PASSWORD@localhost:5433/dialadrink_prod"
# 3) Run:
#    cd backend && NODE_TLS_REJECT_UNAUTHORIZED=0 ./scripts/sync-local-to-prod.sh

set -e
cd "$(dirname "$0")/.."

# Optional: use local .env DATABASE_URL as source if SOURCE_DATABASE_URL not set
if [ -z "$SOURCE_DATABASE_URL" ] && [ -f .env ]; then
  SOURCE_DATABASE_URL=$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//; s/^# *//' | tr -d '"' | tr -d "'")
  [ -n "$SOURCE_DATABASE_URL" ] && export SOURCE_DATABASE_URL
fi

# Optional: get TARGET (production) from gcloud if TARGET_DATABASE_URL not set
if [ -z "$TARGET_DATABASE_URL" ]; then
  PROD_IP=$(gcloud sql instances describe dialadrink-db-prod --project dialadrink-production --format="get(ipAddresses[0].ipAddress)" 2>/dev/null || true)
  [ -z "$PROD_IP" ] && PROD_IP="35.223.10.1"
  PROD_URL=$(gcloud run services describe deliveryos-production-backend --region us-central1 --project dialadrink-production --format=json 2>/dev/null | jq -r '.spec.template.spec.containers[0].env[]? | select(.name=="DATABASE_URL") | .value // empty')
  if [ -n "$PROD_URL" ] && [ "$PROD_URL" != "null" ]; then
    # Convert Cloud SQL socket URL to public IP URL for use from local machine
    TARGET_DATABASE_URL=$(echo "$PROD_URL" | sed "s|@/|@${PROD_IP}:5432/|; s|\?host=[^?]*|\?sslmode=require|")
    export TARGET_DATABASE_URL
  fi
fi

if [ -z "$SOURCE_DATABASE_URL" ] || [ -z "$TARGET_DATABASE_URL" ]; then
  echo "❌ Set SOURCE_DATABASE_URL (local) and/or TARGET_DATABASE_URL (production) before running."
  echo "   Example: export SOURCE_DATABASE_URL='postgresql://user:pass@localhost:5432/dialadrink'"
  echo "   Script can infer TARGET from gcloud if you have it configured."
  echo "   Or use Cloud SQL Proxy for prod: cloud_sql_proxy -instances=dialadrink-production:us-central1:dialadrink-db-prod=tcp:5433"
  exit 1
fi

echo "🚀 Syncing from local DB -> production DB"
echo "   Source: (local)"
echo "   Target: production (dialadrink_prod)"
echo ""

echo "📋 Step 1: Tags + pageTitle..."
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" DATABASE_URL="$TARGET_DATABASE_URL" node scripts/sync-tags-from-local-to-dev.js
echo ""

echo "📋 Step 2: Slugs..."
SOURCE_DATABASE_URL="$SOURCE_DATABASE_URL" DATABASE_URL="$TARGET_DATABASE_URL" node scripts/sync-slugs-from-local-to-dev.js
echo ""

echo "✅ Sync to production complete."
