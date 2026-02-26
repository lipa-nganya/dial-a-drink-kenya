# Category-Based SEO URLs Implementation

## Overview

This document outlines the implementation of category-based SEO-friendly product URLs, transitioning from `/product/{id}` to `/{categorySlug}/{productSlug}` format.

**Old URL Format:** `/product/{id}` or `/product/{slug}`
**New URL Format:** `/{categorySlug}/{productSlug}`

**Example:**
- Old: `https://www.ruakadrinksdelivery.co.ke/product/306`
- New: `https://www.ruakadrinksdelivery.co.ke/wine/1659-sauvignon-blanc-750ml`

## Implementation Details

### 1. Database Changes

#### Categories Table
- Added `slug` column (VARCHAR, UNIQUE) to `categories` table
- Created unique index `categories_slug_idx` on `slug` column
- Migration file: `backend/migrations/add-slug-to-categories.js`

#### Products Table
- Already has `slug` column from previous implementation
- Products are linked to categories via `categoryId`

### 2. Category Slug Generation

- Utility functions in `backend/utils/slugGenerator.js`:
  - `generateCategorySlugFromName(categoryName)`: Generates base slug from category name
  - `generateUniqueCategorySlug(sequelize, baseSlug, excludeId)`: Ensures uniqueness
  - `generateCategorySlug(category, sequelize, excludeId)`: Main function for generating category slugs

- Category model (`backend/models/Category.js`) includes hooks:
  - `beforeCreate`: Auto-generates slug when category is created
  - `beforeUpdate`: Regenerates slug when category name changes

- Script: `backend/scripts/generate-slugs-for-categories.js` generates slugs for all existing categories

### 3. Backend Routes

#### New Route: `/api/products/:categorySlug/:productSlug`
- File: `backend/routes/products.js`
- Fetches product by category slug and product slug
- Verifies product belongs to the specified category
- Returns 404 if category or product not found, or if category mismatch

#### Updated Route: `/api/drinks/:id`
- File: `backend/routes/drinks.js`
- Handles both numeric IDs and slugs
- **301 Permanent Redirect**: If accessed via numeric ID or old slug format, redirects to new category-based URL
- Redirect format: `/{categorySlug}/{productSlug}`

#### Updated Route: `/api/drinks` (GET all)
- Now includes `category.slug` in the response attributes
- Ensures all product listings include category slug for frontend URL generation

### 4. Frontend Routing

#### React Router Routes (`frontend/src/App.js`)
- **New Route**: `/:categorySlug/:productSlug` - Handles category-based URLs
- **Old Route**: `/product/:id` - Kept for backward compatibility and redirects
- Route order is important: Specific routes (like `/menu`, `/cart`) come before the catch-all `/:categorySlug/:productSlug`

#### ProductPage Component (`frontend/src/pages/ProductPage.js`)
- Supports both URL formats:
  - New: `/:categorySlug/:productSlug`
  - Old: `/product/:id`
- Detects URL format using `useParams()`
- Fetches product via appropriate API endpoint:
  - New format: `/api/products/:categorySlug/:productSlug`
  - Old format: `/api/drinks/:id`
- **Client-side redirect**: If accessed via old format, automatically redirects to new category-based URL using `window.location.replace()`
- **Canonical URL**: Sets canonical tag to new format: `/{categorySlug}/{productSlug}`

### 5. Internal Links

#### DrinkCard Component (`frontend/src/components/DrinkCard.js`)
- Updated `handleCardClick()` to use category-based URLs
- Priority:
  1. `/{categorySlug}/{productSlug}` (if both slugs available)
  2. `/product/{slug}` (fallback if category slug missing)
  3. `/product/{id}` (last resort)

#### Share Functionality (`frontend/src/utils/generateShareImage.js`)
- Updated to use category-based URLs in shared links
- Format: `/{categorySlug}/{productSlug}`

### 6. SEO Features

#### Canonical URLs
- Product pages include `<link rel="canonical">` tag
- Points to: `https://www.ruakadrinksdelivery.co.ke/{categorySlug}/{productSlug}`
- Ensures search engines know the canonical version of each product page

#### Redirects
- **301 Permanent Redirects** from old URLs to new URLs
- Backend redirects: `/api/drinks/{id}` → `/api/products/{categorySlug}/{productSlug}`
- Frontend redirects: `/product/{id}` → `/{categorySlug}/{productSlug}`
- Old URLs never return HTTP 200, always redirect

### 7. Backward Compatibility

- All old URLs continue to work via redirects
- Existing bookmarks, WhatsApp links, and indexed Google pages redirect automatically
- System internally still uses `product_id` for database operations
- API endpoints still accept numeric IDs and old slug formats

## Testing Checklist

- [ ] **New URL Format**:
  - Access `/{categorySlug}/{productSlug}` directly
  - Verify page loads correctly with HTTP 200
  - Verify canonical URL is set correctly

- [ ] **Old URL Redirects**:
  - Access `/product/{numericId}` (e.g., `/product/306`)
  - Verify automatic redirect to `/{categorySlug}/{productSlug}`
  - Verify redirect is permanent (301) via browser dev tools

- [ ] **Old Slug URL Redirects**:
  - Access `/product/{slug}` (e.g., `/product/1659-wine-1659-sauvignon-blanc-750ml`)
  - Verify redirect to `/{categorySlug}/{productSlug}`

- [ ] **Internal Links**:
  - Click product cards on homepage
  - Click products in search results
  - Click related products on product page
  - Verify all links use new category-based format

- [ ] **Share Functionality**:
  - Share a product
  - Verify shared URL uses category-based format

- [ ] **API Endpoints**:
  - Test `/api/products/{categorySlug}/{productSlug}`
  - Test `/api/drinks/{id}` redirects
  - Verify category mismatch returns 404

- [ ] **Error Handling**:
  - Access non-existent category slug
  - Access non-existent product slug
  - Access product in wrong category
  - Verify appropriate 404 errors

## Deployment Steps

1. **Database Migration**:
   ```bash
   cd backend
   node -e "const db = require('./models'); db.sequelize.getQueryInterface().addColumn('categories', 'slug', { type: db.Sequelize.STRING, allowNull: true, unique: true }).then(() => db.sequelize.getQueryInterface().addIndex('categories', ['slug'], { name: 'categories_slug_idx', unique: true })).then(() => { console.log('✅ Migration complete'); process.exit(0); });"
   ```

2. **Generate Category Slugs**:
   ```bash
   cd backend
   node scripts/generate-slugs-for-categories.js
   ```

3. **Deploy Backend**:
   - Deploy updated routes (`backend/routes/products.js`, `backend/routes/drinks.js`)
   - Deploy updated models (`backend/models/Category.js`)
   - Deploy updated utilities (`backend/utils/slugGenerator.js`)

4. **Deploy Frontend**:
   - Deploy updated routing (`frontend/src/App.js`)
   - Deploy updated components (`frontend/src/pages/ProductPage.js`, `frontend/src/components/DrinkCard.js`)
   - Deploy updated utilities (`frontend/src/utils/generateShareImage.js`)

5. **Verify**:
   - Test all URLs work correctly
   - Verify redirects are functioning
   - Check canonical URLs in page source
   - Monitor for any 404 errors

## Notes

- Route ordering in React Router is critical: Specific routes must come before the catch-all `/:categorySlug/:productSlug` route
- The backend API still accepts numeric IDs and old slug formats for backward compatibility
- All redirects use HTTP 301 (Permanent Redirect) to preserve SEO value
- Category slugs are generated automatically when categories are created or updated
- Product slugs were already generated in the previous SEO URL implementation
