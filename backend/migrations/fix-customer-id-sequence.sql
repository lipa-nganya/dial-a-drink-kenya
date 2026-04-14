-- Fix Customer ID sequence
-- This resets the sequence to the max ID + 1 to prevent duplicate ID errors

-- Check current sequence value
SELECT currval(pg_get_serial_sequence('customers', 'id')) AS current_sequence;

-- Check max ID in table
SELECT MAX(id) AS max_id FROM customers;

-- Reset sequence to max ID + 1
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 1), true);

-- Verify the fix
SELECT currval(pg_get_serial_sequence('customers', 'id')) AS new_sequence_value;
