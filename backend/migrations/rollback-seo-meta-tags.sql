-- ============================================================================
-- SEO Meta Tags Rollback Migration
-- ============================================================================
-- This script removes the SEO meta title and description settings
-- from the settings table.
--
-- Run this in pgAdmin if you need to rollback the SEO meta tags changes.
-- ============================================================================

-- Delete SEO Meta Title
DELETE FROM settings WHERE key = 'seoMetaTitle';

-- Delete SEO Meta Description
DELETE FROM settings WHERE key = 'seoMetaDescription';

-- Verify the deletions
SELECT * FROM settings WHERE key IN ('seoMetaTitle', 'seoMetaDescription');
-- Should return 0 rows
