-- Add isStop field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='isStop'
  ) THEN
    ALTER TABLE orders ADD COLUMN "isStop" BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN orders."isStop" IS 'Whether this order is a stop (deducts from driver savings)';
    RAISE NOTICE 'Added isStop column';
  ELSE
    RAISE NOTICE 'isStop column already exists';
  END IF;
END
$$;

-- Add stopDeductionAmount field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='orders' AND column_name='stopDeductionAmount'
  ) THEN
    ALTER TABLE orders ADD COLUMN "stopDeductionAmount" DECIMAL(10, 2) DEFAULT 100.00;
    COMMENT ON COLUMN orders."stopDeductionAmount" IS 'Amount to deduct from driver savings when order is completed (default 100)';
    RAISE NOTICE 'Added stopDeductionAmount column';
  ELSE
    RAISE NOTICE 'stopDeductionAmount column already exists';
  END IF;
END
$$;
