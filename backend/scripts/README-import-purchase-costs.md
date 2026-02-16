# Import Purchase Costs from SQL File

This script imports purchase costs from a MySQL SQL dump file and maps them to existing products in the PostgreSQL database.

## Prerequisites

1. PostgreSQL database must be running and accessible
2. The SQL file must be located at `/Users/maria/Documents/dial a drink database.sql` (or provide path as argument)
3. The `drinks` table must have a `purchasePrice` column (already exists)

## Usage

```bash
cd backend
node scripts/import-purchase-costs-from-sql.js [path-to-sql-file]
```

If no path is provided, it defaults to `/Users/maria/Documents/dial a drink database.sql`

## What it does

1. **Parses the SQL file** - Extracts product names and costs from `tec_products` table
2. **Matches products** - Uses fuzzy matching to match SQL products to existing drinks by name
3. **Updates purchase prices** - Only updates drinks that don't already have a purchase price (won't overwrite existing data)
4. **Generates a report** - Creates a detailed report of matched, skipped, and unmatched products

## Matching Logic

- Products are matched by name using fuzzy matching (similarity >= 60%)
- Normalizes names by:
  - Converting to lowercase
  - Removing special characters
  - Removing volume units (ml, litre, etc.)
  - Trimming whitespace
- Only updates drinks that don't already have a `purchasePrice` value

## Output

- Console output showing progress and results
- Report file: `backend/scripts/purchase-cost-import-report.txt`

## Example Output

```
🚀 Starting purchase cost import...
✅ Database connection successful
📖 Reading SQL file: /Users/maria/Documents/dial a drink database.sql
✅ Extracted 1234 unique products with costs
📦 Fetching existing drinks from database...
✅ Found 567 drinks in database
🔍 Matching products...
📊 Matching Results:
  ✅ Matched: 450
  ⏭️  Skipped (already has price): 50
  ❌ Unmatched: 734
💾 Updating purchase prices...
✅ Successfully updated 450 purchase prices
✅ Report saved to: backend/scripts/purchase-cost-import-report.txt
```

## Notes

- The script uses streaming to handle large SQL files efficiently
- It will NOT overwrite existing purchase prices
- Unmatched products are listed in the report for manual review
- The script is idempotent - safe to run multiple times
