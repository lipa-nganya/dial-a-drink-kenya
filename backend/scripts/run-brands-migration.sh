#!/bin/bash

# Helper script to run brands migration on Google Cloud SQL
# This script provides options for connecting to Cloud SQL

set -e

INSTANCE_NAME="drink-suite-db"
CONNECTION_NAME="drink-suite:us-central1:drink-suite-db"
DB_NAME="dialadrink"
DB_USER="dialadrink_app"

echo "🚀 Brands Migration to Cloud SQL"
echo "================================"
echo ""
echo "Instance: $INSTANCE_NAME"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Check if DATABASE_URL is already set
if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL is already set"
  echo "📊 Running migration with existing DATABASE_URL..."
  echo ""
  cd "$(dirname "$0")/.."
  node scripts/migrate-brands-to-cloud-sql.js
  exit 0
fi

echo "Choose connection method:"
echo "1) Use Cloud SQL Proxy (Recommended - requires cloud_sql_proxy installed)"
echo "2) Use connection string directly (requires password)"
echo "3) Use gcloud to get connection details"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo ""
    echo "🔌 Option 1: Cloud SQL Proxy"
    echo "============================"
    echo ""
    
    # Check if cloud_sql_proxy is installed
    if ! command -v cloud_sql_proxy &> /dev/null; then
      echo "❌ cloud_sql_proxy not found!"
      echo ""
      echo "Please install Cloud SQL Proxy:"
      echo "  macOS: brew install cloud-sql-proxy"
      echo "  Or download from: https://cloud.google.com/sql/docs/postgres/sql-proxy"
      exit 1
    fi
    
    # Check if proxy is already running
    if pgrep -f cloud_sql_proxy > /dev/null; then
      echo "✅ Cloud SQL Proxy is already running"
      PROXY_PORT=5432
    else
      echo "📡 Starting Cloud SQL Proxy..."
      PROXY_PORT=5432
      cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:$PROXY_PORT &
      PROXY_PID=$!
      echo "✅ Cloud SQL Proxy started (PID: $PROXY_PID)"
      echo "⏳ Waiting 3 seconds for proxy to initialize..."
      sleep 3
    fi
    
    # Get password
    echo ""
    read -sp "Enter database password for user '$DB_USER': " DB_PASSWORD
    echo ""
    
    export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@localhost:${PROXY_PORT}/${DB_NAME}"
    echo ""
    echo "📊 Running migration..."
    echo ""
    cd "$(dirname "$0")/.."
    node scripts/migrate-brands-to-cloud-sql.js
    
    # Cleanup proxy if we started it
    if [ -n "$PROXY_PID" ]; then
      echo ""
      echo "🛑 Stopping Cloud SQL Proxy..."
      kill $PROXY_PID 2>/dev/null || true
    fi
    ;;
    
  2)
    echo ""
    echo "🔌 Option 2: Direct Connection String"
    echo "====================================="
    echo ""
    read -p "Enter database password for user '$DB_USER': " -s DB_PASSWORD
    echo ""
    echo ""
    read -p "Enter Cloud SQL instance IP address (or press Enter to use connection name): " DB_HOST
    
    if [ -z "$DB_HOST" ]; then
      # Use Unix socket connection
      export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"
    else
      # Use TCP connection
      export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
    fi
    
    echo ""
    echo "📊 Running migration..."
    echo ""
    cd "$(dirname "$0")/.."
    node scripts/migrate-brands-to-cloud-sql.js
    ;;
    
  3)
    echo ""
    echo "🔌 Option 3: Get Connection Details from gcloud"
    echo "==============================================="
    echo ""
    echo "Getting Cloud SQL instance IP address..."
    DB_HOST=$(gcloud sql instances describe $INSTANCE_NAME --format="value(ipAddresses[0].ipAddress)" 2>/dev/null || echo "")
    
    if [ -z "$DB_HOST" ]; then
      echo "❌ Could not get IP address. You may need to:"
      echo "   1. Enable public IP on the Cloud SQL instance, or"
      echo "   2. Use Cloud SQL Proxy (Option 1)"
      exit 1
    fi
    
    echo "✅ Found IP address: $DB_HOST"
    echo ""
    read -sp "Enter database password for user '$DB_USER': " DB_PASSWORD
    echo ""
    echo ""
    
    export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?sslmode=require"
    
    echo "📊 Running migration..."
    echo ""
    cd "$(dirname "$0")/.."
    node scripts/migrate-brands-to-cloud-sql.js
    ;;
    
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac



