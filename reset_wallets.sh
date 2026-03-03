#!/usr/bin/env bash
set -euo pipefail

# Use your local DB connection string here if DATABASE_URL is not set
: "${DATABASE_URL:=postgres://postgres:postgres@localhost:5432/dialadrink_dev}"

echo "This will DELETE all cash-at-hand & savings-related transactions and ZERO balances in drivers/admin_wallets."
read -p "Type RESET_WALLETS to continue: " CONFIRM
if [ "$CONFIRM" != "RESET_WALLETS" ]; then
  echo "Aborted."
  exit 1
fi

psql "$DATABASE_URL" <<'SQL'
BEGIN;

-- Delete savings & cash-at-hand related transactions
DELETE FROM transactions
WHERE transaction_type IN ('savings_credit','cash_settlement','delivery_fee_debit','cash_submission');

-- Zero driver cash at hand
UPDATE drivers
SET "cashAtHand" = 0;

-- Zero driver wallet savings
UPDATE driver_wallets
SET savings = 0;

-- Zero admin wallet cash at hand
UPDATE admin_wallets
SET "cashAtHand" = 0;

COMMIT;
SQL

echo "Done. All relevant transactions deleted and balances set to 0."