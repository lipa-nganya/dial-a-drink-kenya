-- Migration: Add locationLatitude and locationLongitude columns to drivers table
-- Date: 2026-01-05
-- Description: Adds location tracking columns to drivers table for route optimization

-- Add locationLatitude column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' 
        AND column_name = 'locationLatitude'
    ) THEN
        ALTER TABLE drivers 
        ADD COLUMN "locationLatitude" DECIMAL(10, 8);
        COMMENT ON COLUMN drivers."locationLatitude" IS 'Current latitude of the driver';
    END IF;
END $$;

-- Add locationLongitude column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'drivers' 
        AND column_name = 'locationLongitude'
    ) THEN
        ALTER TABLE drivers 
        ADD COLUMN "locationLongitude" DECIMAL(11, 8);
        COMMENT ON COLUMN drivers."locationLongitude" IS 'Current longitude of the driver';
    END IF;
END $$;

