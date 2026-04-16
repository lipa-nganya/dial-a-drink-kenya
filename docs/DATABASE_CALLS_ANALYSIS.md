# Database Calls Analysis - Customer Site

## Summary
When a user opens https://dialadrinkkenya.com, the following database queries are executed:

---

## On Page Load (Home Page)

### 1. **Health Check Ping** (Every 5 minutes)
- **Endpoint:** `GET /api/health`
- **Database Query:** None (just returns status)
- **Frequency:** Once immediately, then every 5 minutes
- **Purpose:** Keep backend warm

### 2. **SEO Meta Tags**
- **Endpoint:** `GET /api/settings`
- **Database Query:** 
  ```sql
  SELECT * FROM settings WHERE key IN ('seoMetaTitle', 'seoMetaDescription')
  ```
- **Frequency:** Once on load
- **Tables:** `settings`

### 3. **Hero Image**
- **Endpoint:** `GET /api/settings/heroImage?_t={timestamp}`
- **Database Query:**
  ```sql
  SELECT * FROM settings WHERE key = 'heroImage'
  ```
- **Frequency:** 
  - Once on load
  - Every time user switches back to tab (visibility change)
  - Every 5 minutes (interval)
- **Tables:** `settings`
- **⚠️ HIGH FREQUENCY ISSUE**

### 4. **Hero Link Settings**
- **Endpoint:** `GET /api/settings/heroLinkSettings`
- **Database Query:**
  ```sql
  SELECT * FROM settings WHERE key = 'heroLinkSettings'
  ```
- **Frequency:** 
  - Once on load
  - Every time user switches back to tab
  - Every 5 minutes
- **Tables:** `settings`
- **⚠️ HIGH FREQUENCY ISSUE**

### 5. **All Drinks** (Popular Drinks)
- **Endpoint:** `GET /api/drinks`
- **Database Query:**
  ```sql
  -- First, check for columns
  SELECT column_name FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'drinks'
  
  -- Then fetch all drinks
  SELECT d.*, 
         c.id, c.name, c.slug, c.description, c.image, c.isActive,
         sc.id, sc.name, sc.categoryId,
         b.id, b.name
  FROM drinks d
  LEFT JOIN categories c ON d.categoryId = c.id
  LEFT JOIN subcategories sc ON d.subCategoryId = sc.id
  LEFT JOIN brands b ON d.brandId = b.id
  WHERE d.isPublished = true
  ORDER BY d.isAvailable DESC, d.name ASC
  ```
- **Frequency:** Once on load
- **Tables:** `drinks`, `categories`, `subcategories`, `brands`, `information_schema.columns`
- **⚠️ FETCHES ALL DRINKS** (could be 1000+)

### 6. **Brand Focus Drinks**
- **Endpoint:** `GET /api/settings/brandFocus` then `GET /api/drinks`
- **Database Queries:**
  ```sql
  -- Get brand focus setting
  SELECT * FROM settings WHERE key = 'brandFocus'
  
  -- Then fetch ALL drinks again (same as #5)
  SELECT d.*, c.*, sc.*, b.*
  FROM drinks d
  LEFT JOIN categories c ON d.categoryId = c.id
  LEFT JOIN subcategories sc ON d.subCategoryId = sc.id
  LEFT JOIN brands b ON d.brandId = b.id
  WHERE d.isPublished = true
  ORDER BY d.isAvailable DESC, d.name ASC
  ```
- **Frequency:** Once on load
- **Tables:** `settings`, `drinks`, `categories`, `subcategories`, `brands`
- **⚠️ DUPLICATE QUERY** - Fetches ALL drinks again!

### 7. **Limited Time Offers**
- **Endpoint:** `GET /api/drinks/offers`
- **Database Query:**
  ```sql
  SELECT d.*, c.*, sc.*, b.*
  FROM drinks d
  LEFT JOIN categories c ON d.categoryId = c.id
  LEFT JOIN subcategories sc ON d.subCategoryId = sc.id
  LEFT JOIN brands b ON d.brandId = b.id
  WHERE d.isPublished = true 
    AND (d.limitedTimeOffer = true OR d.isOnOffer = true)
  ORDER BY d.isAvailable DESC, d.name ASC
  ```
- **Frequency:** Once on load
- **Tables:** `drinks`, `categories`, `subcategories`, `brands`

### 8. **Countdown Timer**
- **Endpoint:** `GET /api/countdown/current`
- **Database Query:**
  ```sql
  SELECT * FROM countdowns 
  WHERE NOW() BETWEEN startTime AND endTime 
  ORDER BY createdAt DESC 
  LIMIT 1
  ```
- **Frequency:** Once on load
- **Tables:** `countdowns`

---

## TOTAL DATABASE QUERIES ON HOME PAGE LOAD:
1. SEO settings (1 query)
2. Hero image (1 query)
3. Hero link (1 query)
4. Column check for drinks (1 query)
5. **All drinks - First fetch** (1 query with 3 joins) - Returns ALL drinks
6. Brand focus setting (1 query)
7. **All drinks - Second fetch** (1 query with 3 joins) - Returns ALL drinks AGAIN
8. Limited time offers (1 query with 3 joins)
9. Countdown (1 query)

**Total: ~10 queries on initial load**
**⚠️ Problem: Fetching ALL drinks TWICE in queries #5 and #7**

---

## Recurring Queries (While User Stays on Page)

### Every 5 Minutes:
- Hero image refresh (1 query)
- Hero link refresh (1 query)
- Health check (0 queries)

### Every Tab Switch Back:
- Hero image refresh (1 query)
- Hero link refresh (1 query)

---

## Cost Analysis

### Why Costs Are High:

1. **Duplicate Drinks Query**
   - Home page fetches ALL drinks twice (once for popular, once for brand focus)
   - If you have 1000 drinks, this means 2000+ rows returned (with joins)
   - Each query scans entire drinks table + 3 joins

2. **Frequent Hero Image Polling**
   - Every 5 minutes = 12 times per hour
   - Every tab switch = variable (could be 10+ times per hour)
   - Total: ~20+ unnecessary queries per hour per user

3. **No Caching**
   - Every user fetches ALL drinks on every page load
   - No browser caching or CDN for API responses
   - Settings table queried multiple times per session

4. **Inefficient Filtering**
   - Frontend filters drinks after fetching ALL of them
   - Backend should filter and return only needed drinks

---

## Recommended Optimizations

### HIGH PRIORITY (Biggest Impact):

1. **Fix Duplicate Drinks Query**
   - Combine popular drinks and brand focus into single query
   - Use query parameters: `GET /api/drinks?popular=true&brandFocus={brandId}`
   - **Savings: 50% reduction in drinks queries**

2. **Add Query Filters to Backend**
   - Instead of fetching ALL drinks, fetch only what's needed:
     - `GET /api/drinks?popular=true` (for Popular Drinks section)
     - `GET /api/drinks?brandId={id}&brandFocus=true` (for Brand Focus section)
   - **Savings: 90%+ reduction in data transfer and query time**

3. **Remove Frequent Hero Image Polling**
   - Don't poll every 5 minutes - hero image rarely changes
   - Only fetch on page load, not on visibility change
   - **Savings: 90% reduction in settings queries**

4. **Add HTTP Caching Headers**
   - Cache drinks response for 5 minutes
   - Cache settings for 15 minutes
   - **Savings: 80%+ reduction in repeated queries**

5. **Add Database Indexes**
   - Index on `drinks.isPublished`
   - Index on `drinks.isPopular`
   - Index on `drinks.isBrandFocus`
   - Index on `drinks.brandId`
   - **Savings: Faster query execution**

### MEDIUM PRIORITY:

6. **Combine Settings Queries**
   - Single endpoint: `GET /api/settings/homepage` returns all home page settings
   - **Savings: 4 queries → 1 query**

7. **Add Redis Cache**
   - Cache drinks list for 5 minutes
   - Cache settings for 15 minutes
   - **Savings: 95% reduction for returning users**

### LOW PRIORITY:

8. **Lazy Load Sections**
   - Only fetch Brand Focus when user scrolls to it
   - Only fetch Limited Time Offers when visible

---

## Estimated Cost Reduction:

| Optimization | Query Reduction | Cost Reduction |
|--------------|----------------|----------------|
| Fix duplicate drinks query | 50% | ~30% |
| Backend filtering | 90% data transfer | ~25% |
| Stop hero polling | 90% settings queries | ~15% |
| HTTP caching | 80% repeat queries | ~20% |
| Redis cache | 95% for cache hits | ~30% |

**Total Potential Savings: 70-80% reduction in database costs**

---

## Current Query Load Estimate:

Assuming 1000 visitors per day:
- Initial load: 10 queries × 1000 = 10,000 queries
- Hero polling: 20 queries/hour × 2 hours avg × 1000 = 40,000 queries
- **Total: ~50,000 queries per day from home page alone**

With optimizations:
- Initial load: 5 queries × 1000 = 5,000 queries
- Hero polling: 0 (removed)
- Cached queries: 80% cache hit = 1,000 actual queries
- **Total: ~6,000 queries per day (88% reduction)**
