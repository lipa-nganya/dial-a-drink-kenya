-- orders.inventoryDeductedAt — run in pgAdmin (or psql) BEFORE deploying backend that uses this column.
-- Idempotent: skips if the column already exists.
-- Sequelize maps DataTypes.DATE to TIMESTAMP WITH TIME ZONE in PostgreSQL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'orders'
      AND column_name = 'inventoryDeductedAt'
  ) THEN
    ALTER TABLE orders
      ADD COLUMN "inventoryDeductedAt" TIMESTAMP WITH TIME ZONE NULL;
    COMMENT ON COLUMN orders."inventoryDeductedAt" IS
      'When inventory was decreased for this order (stock/stockByCapacity); cleared if restored on cancel';
  END IF;
END $$;
