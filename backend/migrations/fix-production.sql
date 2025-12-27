-- Add cashAtHand to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS "cashAtHand" DECIMAL(10, 2) DEFAULT 0;

-- Add adminOrder to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adminOrder" BOOLEAN NOT NULL DEFAULT false;

-- Add territoryId to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "territoryId" INTEGER;

-- Create supplier_transactions table if it doesn't exist
DO $$ BEGIN
  CREATE TYPE supplier_transaction_type_enum AS ENUM ('credit', 'debit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions("supplierId");
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at ON supplier_transactions("createdAt");
CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type ON supplier_transactions("transactionType");

