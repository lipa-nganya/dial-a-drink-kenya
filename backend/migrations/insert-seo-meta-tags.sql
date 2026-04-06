-- ============================================================================
-- SEO Meta Tags Migration
-- ============================================================================
-- This migration inserts the SEO meta title and description settings
-- into the settings table for both development and production databases.
--
-- The settings table already exists with the following structure:
--   - id (INTEGER, PRIMARY KEY, AUTO INCREMENT)
--   - key (STRING, NOT NULL, UNIQUE)
--   - value (TEXT, NULLABLE)
--   - createdAt (TIMESTAMP)
--   - updatedAt (TIMESTAMP)
--
-- Run this in pgAdmin for both development and production databases.
-- ============================================================================

-- Insert SEO Meta Title
-- Uses INSERT ... ON CONFLICT to avoid errors if the key already exists
INSERT INTO settings (key, value, "createdAt", "updatedAt")
VALUES (
    'seoMetaTitle',
    'Alcohol Delivery Nairobi - Dial A Drink Kenya - 24 hours Fast Delivery',
    NOW(),
    NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
    value = EXCLUDED.value,
    "updatedAt" = NOW();

-- Insert SEO Meta Description
INSERT INTO settings (key, value, "createdAt", "updatedAt")
VALUES (
    'seoMetaDescription',
    'Alcohol delivery in Nairobi and its environs in under 30 minutes! Wide variety of whisky, wine, cognacs, gin etc Call 0723688108 to order.',
    NOW(),
    NOW()
)
ON CONFLICT (key) 
DO UPDATE SET 
    value = EXCLUDED.value,
    "updatedAt" = NOW();

-- Verify the inserts
SELECT * FROM settings WHERE key IN ('seoMetaTitle', 'seoMetaDescription');
