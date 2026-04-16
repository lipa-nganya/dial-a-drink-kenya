-- Admin / dashboard workload: safe indexes to speed common filters and sorts.
-- Run on production after verifying column names match your schema (Sequelize camelCase = quoted identifiers in PostgreSQL).
-- Use IF NOT EXISTS so re-runs are safe.

-- ---------------------------------------------------------------------------
-- orders: dashboard "latest orders", date-bounded counts, status filters
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON orders("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status_pending_confirmed ON orders(status)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_orders_payment_status_paid ON orders("paymentStatus")
  WHERE "paymentStatus" = 'paid';

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders("createdAt");

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders("updatedAt");

-- ---------------------------------------------------------------------------
-- transactions: latest list + tip counts by type/status/time
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_desc ON transactions("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_tip_completed ON transactions("transactionType", status, "createdAt")
  WHERE "transactionType" = 'tip' AND status = 'completed';

-- ---------------------------------------------------------------------------
-- order_items: top-inventory aggregation by drinkId
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_order_items_drink_id ON order_items("drinkId");

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items("orderId");

-- ---------------------------------------------------------------------------
-- cash_submissions: pending list for admin badges (poll every 30s)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cash_submissions_status_pending_created ON cash_submissions(status, "createdAt" DESC)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- settings: paywall and other key lookups
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- ---------------------------------------------------------------------------
-- inventory_checks: pending list for admin
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_checks_status_created ON inventory_checks(status, "createdAt" DESC);

-- ---------------------------------------------------------------------------
ANALYZE orders;
ANALYZE transactions;
ANALYZE order_items;
ANALYZE cash_submissions;
ANALYZE settings;
ANALYZE inventory_checks;
