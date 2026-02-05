#!/bin/bash
# Script to add cashAtHand column to admin_wallets table on dev database
# This connects to Cloud SQL and adds the column if it doesn't exist

set -e

echo "🔌 Connecting to dev database (Cloud SQL)..."
echo "📝 Adding cashAtHand column to admin_wallets table..."
echo ""

# Use gcloud sql to execute the migration
gcloud sql connect drink-suite-db \
  --user=dialadrink_app \
  --database=dialadrink \
  --project=drink-suite << 'SQL'
-- Add cashAtHand column to admin_wallets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_wallets' 
    AND column_name = 'cashAtHand'
  ) THEN
    ALTER TABLE admin_wallets 
    ADD COLUMN "cashAtHand" DECIMAL(10, 2) DEFAULT 0;
    
    COMMENT ON COLUMN admin_wallets."cashAtHand" IS 'Cash at hand amount for admin (calculated from cash orders - settlements - submissions)';
    
    RAISE NOTICE 'Column cashAtHand added to admin_wallets table';
  ELSE
    RAISE NOTICE 'Column cashAtHand already exists in admin_wallets table';
  END IF;
END $$;

-- Verify the column exists
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_wallets' 
AND column_name = 'cashAtHand';

\q
SQL

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Verifying column was added..."
echo "   Check the output above to confirm cashAtHand column exists"
