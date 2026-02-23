#!/bin/bash

# Run stop fields migration directly via SQL
# This uses gcloud sql connect to run the migration SQL

set -e

PROJECT_ID="dialadrink-production"
INSTANCE_NAME="dialadrink-db-dev"
DB_NAME="dialadrink_dev"
DB_USER="dialadrink_app"

echo "🔄 Running Stop Fields Migration via SQL"
echo "========================================="
echo ""

# Check if columns already exist
echo "📊 Checking if columns already exist..."
SQL_CHECK="SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name IN ('isStop', 'stopDeductionAmount');"

EXISTING_COLUMNS=$(gcloud sql connect $INSTANCE_NAME \
  --user=$DB_USER \
  --database=$DB_NAME \
  --project=$PROJECT_ID \
  --quiet \
  --command="$SQL_CHECK" 2>/dev/null | grep -E "(isStop|stopDeductionAmount)" || echo "")

if echo "$EXISTING_COLUMNS" | grep -q "isStop" && echo "$EXISTING_COLUMNS" | grep -q "stopDeductionAmount"; then
  echo "✅ Columns 'isStop' and 'stopDeductionAmount' already exist"
  echo "   Migration not needed"
  exit 0
fi

echo "📝 Columns not found, running migration..."
echo ""

# Migration SQL
SQL_MIGRATION="
-- Add isStop field
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='isStop'
  ) THEN
    ALTER TABLE orders ADD COLUMN \"isStop\" BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN orders.\"isStop\" IS 'Whether this order is a stop (deducts from driver savings)';
    RAISE NOTICE 'Added isStop column';
  ELSE
    RAISE NOTICE 'isStop column already exists';
  END IF;
END
\$\$;

-- Add stopDeductionAmount field
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='stopDeductionAmount'
  ) THEN
    ALTER TABLE orders ADD COLUMN \"stopDeductionAmount\" DECIMAL(10, 2) DEFAULT 100.00;
    COMMENT ON COLUMN orders.\"stopDeductionAmount\" IS 'Amount to deduct from driver savings when order is completed (default 100)';
    RAISE NOTICE 'Added stopDeductionAmount column';
  ELSE
    RAISE NOTICE 'stopDeductionAmount column already exists';
  END IF;
END
\$\$;
"

echo "🚀 Executing migration SQL..."
gcloud sql connect $INSTANCE_NAME \
  --user=$DB_USER \
  --database=$DB_NAME \
  --project=$PROJECT_ID \
  --command="$SQL_MIGRATION" \
  --quiet

echo ""
echo "✅ Migration completed successfully!"
