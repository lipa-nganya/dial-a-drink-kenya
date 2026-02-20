# Database Migration Status

## Stop Fields Migration

The migration to add `isStop` and `stopDeductionAmount` columns to the `orders` table is having issues running via Cloud Run Job due to DATABASE_URL parsing problems.

## Current Status

The migration can be run manually via one of these methods:

### Option 1: Check if columns already exist

The columns may already exist. Check with:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='orders' 
AND column_name IN ('isStop', 'stopDeductionAmount');
```

### Option 2: Run migration SQL directly

If columns don't exist, run this SQL via Cloud SQL Console or psql:

```sql
-- Add isStop field
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "isStop" BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN orders."isStop" IS 'Whether this order is a stop (deducts from driver savings)';

-- Add stopDeductionAmount field  
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "stopDeductionAmount" DECIMAL(10, 2) DEFAULT 100.00;
COMMENT ON COLUMN orders."stopDeductionAmount" IS 'Amount to deduct from driver savings when order is completed (default 100)';
```

### Option 3: Use Cloud SQL Console

1. Go to Google Cloud Console
2. Navigate to SQL → dialadrink-db-dev
3. Click "Databases" → dialadrink_dev
4. Use the SQL editor to run the migration SQL above

## Migration Scripts Created

- `run-stop-fields-migration-cloud-run.sh` - Attempts to run via Cloud Run Job (has connection issues)
- `run-stop-fields-migration-dev.sh` - Requires Cloud SQL Proxy locally
- `backend/migrations/add-stop-fields-to-orders.sql` - Raw SQL file
- `backend/scripts/run-stop-fields-migration.js` - Node.js migration script

## Next Steps

1. Check if columns exist (they may have been added already)
2. If not, run the SQL manually via Cloud SQL Console
3. Verify the columns exist and test the stop fields feature
