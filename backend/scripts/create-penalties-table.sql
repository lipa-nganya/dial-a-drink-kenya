-- Script to check and create penalties table if it doesn't exist
-- Run this with: psql -d your_database_name -f scripts/create-penalties-table.sql

-- Check if penalties table exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'penalties'
    ) THEN
        -- Create penalties table
        CREATE TABLE penalties (
            id SERIAL PRIMARY KEY,
            "driverId" INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            amount DECIMAL(10, 2) NOT NULL,
            balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
            reason TEXT NOT NULL,
            "createdBy" INTEGER REFERENCES admins(id),
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
        CREATE INDEX idx_penalties_driver_id ON penalties("driverId");
        CREATE INDEX idx_penalties_created_at ON penalties("createdAt");

        RAISE NOTICE '✅ Penalties table created successfully';
    ELSE
        RAISE NOTICE '✅ Penalties table already exists';
    END IF;
END $$;

-- Display table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'penalties' 
ORDER BY ordinal_position;
