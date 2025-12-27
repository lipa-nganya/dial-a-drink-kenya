#!/bin/bash
# Script to run database migration on production
# This connects to Cloud SQL and runs the migration

echo "🔌 Connecting to production database..."
echo "📝 Running migration script..."

# Use gcloud sql to execute the migration
gcloud sql connect drink-suite-db \
  --user=dialadrink_app \
  --database=dialadrink \
  --project=drink-suite << 'SQL'
-- Add cashAtHand to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS "cashAtHand" DECIMAL(10, 2) DEFAULT 0;

-- Add adminOrder to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adminOrder" BOOLEAN NOT NULL DEFAULT false;

-- Add territoryId to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "territoryId" INTEGER;

-- Create supplier_transactions table if it doesn't exist
DO \$\$ BEGIN
  CREATE TYPE supplier_transaction_type_enum AS ENUM ('credit', 'debit');
EXCEPTION
  WHEN duplicate_object THEN null;
END \$\$;

CREATE TABLE IF NOT EXISTS supplier_transactions (
  id SERIAL PRIMARY KEY,
  "supplierId" INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  "transactionType" supplier_transaction_type_enum NOT NULL,
  amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
  reason TEXT,
  reference VARCHAR(255),
  "createdBy" INTEGER REFERENCES admins(id),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions("supplierId");
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at ON supplier_transactions("createdAt");
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type ON supplier_transactions("transactionType");

\q
SQL

echo "✅ Migration complete!"
