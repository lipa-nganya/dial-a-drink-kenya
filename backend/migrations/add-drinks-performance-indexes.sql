-- Add indexes to improve drinks query performance
-- These indexes will speed up the most common filters used on the customer site

-- Index for published drinks (most common filter)
CREATE INDEX IF NOT EXISTS idx_drinks_is_published ON drinks(isPublished) WHERE isPublished = true;

-- Index for popular drinks
CREATE INDEX IF NOT EXISTS idx_drinks_is_popular ON drinks(isPopular, isPublished) WHERE isPopular = true AND isPublished = true;

-- Index for brand focus drinks
CREATE INDEX IF NOT EXISTS idx_drinks_is_brand_focus ON drinks(isBrandFocus, brandId, isPublished) WHERE isBrandFocus = true AND isPublished = true;

-- Index for brand filtering
CREATE INDEX IF NOT EXISTS idx_drinks_brand_id ON drinks(brandId, isPublished) WHERE isPublished = true;

-- Index for offers
CREATE INDEX IF NOT EXISTS idx_drinks_offers ON drinks(isOnOffer, limitedTimeOffer, isPublished) WHERE (isOnOffer = true OR limitedTimeOffer = true) AND isPublished = true;

-- Index for availability ordering (used in ORDER BY)
CREATE INDEX IF NOT EXISTS idx_drinks_availability_name ON drinks(isAvailable DESC, name ASC) WHERE isPublished = true;

-- Composite index for common join patterns
CREATE INDEX IF NOT EXISTS idx_drinks_category_published ON drinks(categoryId, isPublished) WHERE isPublished = true;
CREATE INDEX IF NOT EXISTS idx_drinks_subcategory_published ON drinks(subCategoryId, isPublished) WHERE isPublished = true;

-- Index for settings table (frequently queried)
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- ANALYZE tables to update query planner statistics
ANALYZE drinks;
ANALYZE settings;
ANALYZE categories;
ANALYZE subcategories;
ANALYZE brands;
