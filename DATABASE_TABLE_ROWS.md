# Row Counts for Tables in "dial a drink database.sql"

**File:** `/Users/maria/Documents/dial a drink database.sql`  
**File Size:** ~527 MB

## Key Order-Related Tables

| Table Name | Row Count | Notes |
|------------|-----------|-------|
| **tec_sales** | **157,239** | ⭐ Primary sales table (TEC system) |
| **tec_sale_items** | **246,284** | ⭐ Sales line items (TEC system) |
| **orders** | **940** | Standard orders table |
| **order_items** | **1,585** | Order line items |
| **customers** | **147,324** | Customer records |
| **delivery** | **92,034** | Delivery records |
| **tec_customers** | 3 | TEC customer records |

## Top 20 Tables by Row Count

| Rank | Table Name | Row Count |
|------|------------|-----------|
| 1 | **tec_sale_items** | **246,284** |
| 2 | **tec_sales** | **157,239** |
| 3 | **customers** | **147,324** |
| 4 | **delivery** | **92,034** |
| 5 | asstes | 2,530 |
| 6 | tec_sessions | 368 |
| 7 | order_items | 1,585 |
| 8 | account_update | 816 |
| 9 | rider_account | 609 |
| 10 | activity_log | 504 |
| 11 | l3_account | 401 |
| 12 | orders | 940 |
| 13 | tb2 | 219 |
| 14 | daily_sales_filter | 219 |
| 15 | supplier_account | 216 |
| 16 | product_details | 207 |
| 17 | share_of_shelf_report | 166 |
| 18 | tb1 | 125 |
| 19 | office_sale_items | 122 |
| 20 | saving | 109 |

## Important Notes

1. **Primary Order Data**: The main order data appears to be in the **`tec_sales`** table with **157,239 rows**, not the `orders` table (which only has 940 rows).

2. **28,020 Orders**: The user mentioned 28,020 orders. This number is likely:
   - A subset of the `tec_sales` table
   - Or refers to a specific date range or status
   - Or might be in a different export/backup

3. **TEC System**: The database uses a "TEC" (likely a POS/inventory system) with:
   - `tec_sales` - Main sales/orders
   - `tec_sale_items` - Sales line items
   - `tec_products` - Products
   - `tec_customers` - Customers

4. **Data Structure**:
   - **Sales/Orders**: `tec_sales` (157K rows) + `orders` (940 rows) = ~158K total
   - **Line Items**: `tec_sale_items` (246K rows) + `order_items` (1.6K rows) = ~248K total
   - **Customers**: `customers` (147K rows)

## Import Strategy

To import the 28,020 orders mentioned:

1. **Check `tec_sales` table** - This likely contains the bulk of order data
2. **Filter by date/status** - The 28,020 might be a filtered subset
3. **Map TEC schema to production schema** - The TEC system has different field names
4. **Import both systems** - Consider importing both `orders` and `tec_sales` if needed

## Next Steps

1. Extract and examine the `tec_sales` table structure
2. Map TEC fields to production `orders` table fields
3. Create import script for TEC sales data
4. Filter/transform data as needed for production import
