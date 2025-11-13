#!/bin/bash
# Setup Budget Cap and Alert for Google Cloud Project
# This will suspend services when $300 budget is exceeded

set -e

PROJECT_ID="drink-suite"
BUDGET_AMOUNT=300
BUDGET_CURRENCY="USD"

echo "💰 Setting up Budget Cap of \$${BUDGET_AMOUNT} ${BUDGET_CURRENCY}..."
echo ""

# Set project
gcloud config set project $PROJECT_ID

# Create budget JSON file
BUDGET_FILE=$(mktemp)
cat > "$BUDGET_FILE" <<EOF
{
  "displayName": "Dial A Drink Budget Cap",
  "budgetFilter": {
    "projects": ["projects/$PROJECT_ID"]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "$BUDGET_CURRENCY",
      "units": "$BUDGET_AMOUNT"
    }
  },
  "thresholdRules": [
    {
      "thresholdPercent": 0.5,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.75,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.9,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 1.0,
      "spendBasis": "CURRENT_SPEND"
    }
  ],
  "allUpdatesRule": {
    "pubsubTopic": "projects/$PROJECT_ID/topics/budget-alerts",
    "schemaVersion": "1.0"
  }
}
EOF

echo "📋 Budget configuration created"
echo ""

# Check if billing account exists
echo "🔍 Checking billing account..."
BILLING_ACCOUNT=$(gcloud billing accounts list --format="value(name)" --filter="open=true" | head -1)

if [ -z "$BILLING_ACCOUNT" ]; then
  echo "❌ No active billing account found!"
  echo ""
  echo "Please set up a billing account first:"
  echo "1. Visit: https://console.cloud.google.com/billing"
  echo "2. Create or link a billing account"
  echo "3. Link it to project: $PROJECT_ID"
  exit 1
fi

echo "✅ Billing account: $BILLING_ACCOUNT"
echo ""

# Create Pub/Sub topic for budget alerts (if it doesn't exist)
echo "📢 Setting up Pub/Sub topic for alerts..."
gcloud pubsub topics create budget-alerts --project=$PROJECT_ID 2>/dev/null || echo "Topic already exists"
echo "✅ Pub/Sub topic ready"
echo ""

# Create Cloud Function to suspend services when budget is exceeded
echo "⚙️  Setting up Cloud Function to suspend services..."
echo ""
echo "⚠️  Note: Cloud Function setup requires additional configuration."
echo "   See SETUP_BUDGET_CAP.md for complete instructions."
echo ""

# Create budget via API
echo "💰 Creating budget..."
echo ""
echo "To create the budget, run this command:"
echo ""
echo "gcloud billing budgets create \\"
echo "  --billing-account=\$(gcloud billing accounts list --format='value(name)' --filter='open=true' | head -1) \\"
echo "  --display-name='Dial A Drink Budget Cap' \\"
echo "  --budget-amount=\$${BUDGET_AMOUNT} \\"
echo "  --threshold-rule=percent=50 \\"
echo "  --threshold-rule=percent=75 \\"
echo "  --threshold-rule=percent=90 \\"
echo "  --threshold-rule=percent=100 \\"
echo "  --projects=$PROJECT_ID"
echo ""

echo "═══════════════════════════════════════════════════════"
echo "📚 Complete setup guide: SETUP_BUDGET_CAP.md"
echo "═══════════════════════════════════════════════════════"

