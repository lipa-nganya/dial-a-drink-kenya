#!/bin/bash
# Clear Orders and Transactions from Production Database
# This script clears all order and transaction data while preserving inventory

set -e

# Production database config
PROD_HOST="35.223.10.1"
PROD_DB="dialadrink_prod"
PROD_USER="dialadrink_app"
PROD_PASSWORD="E7A3IIa60hFD3bkGH1XAiryvB"

echo "🗑️  Clearing Orders and Transactions from Production Database"
echo "=============================================================="
echo ""
echo "⚠️  WARNING: This will delete ALL orders and transactions!"
echo "   This includes:"
echo "   - All orders"
echo "   - All order items"
echo "   - All transactions"
echo "   - All payment records"
echo "   - All cart items"
echo ""
echo "   Inventory data (drinks, categories, brands) will be preserved."
echo ""

read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled"
    exit 1
fi

export PGPASSWORD="$PROD_PASSWORD"

echo ""
echo "🗑️  Clearing orders and transactions..."
echo ""

psql "host=${PROD_HOST} port=5432 dbname=${PROD_DB} user=${PROD_USER} sslmode=require" << 'SQL'
-- Get counts before deletion
DO $$
DECLARE
    order_count INTEGER;
    order_item_count INTEGER;
    transaction_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO order_count FROM orders;
    SELECT COUNT(*) INTO order_item_count FROM order_items;
    SELECT COUNT(*) INTO transaction_count FROM transactions WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions');
    
    RAISE NOTICE 'Current counts:';
    RAISE NOTICE '  Orders: %', order_count;
    RAISE NOTICE '  Order Items: %', order_item_count;
    RAISE NOTICE '  Transactions: %', transaction_count;
END $$;

-- Delete in order to respect foreign key constraints
-- 1. Delete junction tables first (many-to-many relationships)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_submission_orders') THEN
        DELETE FROM cash_submission_orders;
        RAISE NOTICE 'Deleted cash_submission_orders';
    END IF;
END $$;

-- 2. Delete order items first (references orders)
DELETE FROM order_items;

-- 3. Delete order notifications
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_notifications') THEN
        DELETE FROM order_notifications;
        RAISE NOTICE 'Deleted order_notifications';
    END IF;
END $$;

-- 4. Delete valkyrie partner orders
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'valkyrie_partner_orders') THEN
        DELETE FROM valkyrie_partner_orders;
        RAISE NOTICE 'Deleted valkyrie_partner_orders';
    END IF;
END $$;

-- 5. Delete cart items if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items') THEN
        DELETE FROM cart_items;
        RAISE NOTICE 'Deleted cart_items';
    END IF;
END $$;

-- 6. Delete inventory checks if they reference orders
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_checks') THEN
        DELETE FROM inventory_checks;
        RAISE NOTICE 'Deleted inventory_checks';
    END IF;
END $$;

-- 7. Delete transactions if table exists (references orders)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        DELETE FROM transactions;
        RAISE NOTICE 'Deleted transactions';
    END IF;
END $$;

-- 8. Delete payments if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
        DELETE FROM payments;
        RAISE NOTICE 'Deleted payments';
    END IF;
END $$;

-- 9. Delete cash submissions if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cash_submissions') THEN
        DELETE FROM cash_submissions;
        RAISE NOTICE 'Deleted cash_submissions';
    END IF;
END $$;

-- 10. Delete admin cash submissions if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_cash_submissions') THEN
        DELETE FROM admin_cash_submissions;
        RAISE NOTICE 'Deleted admin_cash_submissions';
    END IF;
END $$;

-- 11. Delete orders (after all related records)
DELETE FROM orders;

-- 9. Reset sequences if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_id_seq') THEN
        ALTER SEQUENCE orders_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset orders_id_seq';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'order_items_id_seq') THEN
        ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset order_items_id_seq';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'transactions_id_seq') THEN
        ALTER SEQUENCE transactions_id_seq RESTART WITH 1;
        RAISE NOTICE 'Reset transactions_id_seq';
    END IF;
END $$;

-- Verify deletion
DO $$
DECLARE
    order_count INTEGER;
    order_item_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO order_count FROM orders;
    SELECT COUNT(*) INTO order_item_count FROM order_items;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Final counts:';
    RAISE NOTICE '  Orders: %', order_count;
    RAISE NOTICE '  Order Items: %', order_item_count;
END $$;
SQL

unset PGPASSWORD

echo ""
echo "✅ Orders and transactions cleared from production database!"
echo ""
