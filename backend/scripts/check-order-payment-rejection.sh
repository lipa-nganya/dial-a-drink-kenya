#!/bin/bash
# Script to check order payment rejection details from production database
# Usage: ./backend/scripts/check-order-payment-rejection.sh <order_id>

set -e

ORDER_ID=${1:-6}

echo "🔍 Checking Order #${ORDER_ID} Payment Rejection Details"
echo "=========================================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL not set. Using production database connection..."
  echo "   Set DATABASE_URL environment variable or run from backend directory"
fi

echo "📋 Running diagnostic script..."
cd "$(dirname "$0")/.." || exit 1
node scripts/check-order-6-payment.js

echo ""
echo "📊 To check backend logs for Order #${ORDER_ID}:"
echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-production-backend AND jsonPayload.order.id=${ORDER_ID}\" --limit 50 --format json --project dialadrink-production"
echo ""
echo "📊 To check M-Pesa callback logs:"
echo "   gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=deliveryos-production-backend AND jsonPayload.message=~'Order #${ORDER_ID} payment failed'\" --limit 20 --format json --project dialadrink-production"
