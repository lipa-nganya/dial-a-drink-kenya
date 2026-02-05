# Import MySQL Database into PostgreSQL via pgAdmin

## Overview
Your SQL file (`dial a drink database.sql`) is a MySQL/MariaDB dump that needs to be imported into PostgreSQL. Here's how to do it:

## Option 1: Use pgAdmin (Recommended)

### Step 1: Open pgAdmin
1. Launch pgAdmin 4
2. Connect to your local PostgreSQL server:
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `dialadrink`
   - **Username**: `maria`
   - **Password**: (your PostgreSQL password)

### Step 2: Import the SQL File
Since the file is MySQL format, you have two options:

#### Option A: Manual Conversion (For Small Files)
1. Open the SQL file in a text editor
2. Find and replace:
   - `ENGINE=InnoDB` → (remove)
   - `AUTO_INCREMENT` → `SERIAL`
   - `tinyint(1)` → `BOOLEAN`
   - `int(11)` → `INTEGER`
   - Backticks `` ` `` → (remove)
   - `current_timestamp()` → `CURRENT_TIMESTAMP`
3. Save as a new file
4. In pgAdmin: Right-click `dialadrink` → Query Tool → File → Open → Select your converted file → Execute

#### Option B: Use Online Converter or Tool
1. Use an online MySQL to PostgreSQL converter (e.g., https://www.rebasedata.com/convert-mysql-to-postgresql-online)
2. Upload your SQL file
3. Download the converted PostgreSQL file
4. Import via pgAdmin Query Tool

### Step 3: View the Data
After import:
1. In pgAdmin, expand `dialadrink` database
2. Expand `Schemas` → `public` → `Tables`
3. Right-click any table → `View/Edit Data` → `All Rows`

## Option 2: Use Command Line (psql)

If you prefer command line:

```bash
# First, convert the file (using a tool or manually)
# Then import:
psql -U maria -d dialadrink -f "/Users/maria/Documents/dial-a-drink-postgresql.sql"
```

## Option 3: Use a Conversion Tool

Install and use `mysql2pgsql`:
```bash
# Install (if available via npm)
npm install -g mysql2pgsql

# Convert
mysql2pgsql /Users/maria/Documents/dial\ a\ drink\ database.sql > /Users/maria/Documents/dial-a-drink-postgresql.sql

# Import
psql -U maria -d dialadrink -f /Users/maria/Documents/dial-a-drink-postgresql.sql
```

## Common Issues

### Issue: Syntax Errors
**Solution**: MySQL and PostgreSQL have different syntax. You may need to:
- Remove MySQL-specific keywords (`ENGINE`, `AUTO_INCREMENT`, etc.)
- Convert data types
- Fix boolean values (0/1 → false/true)

### Issue: Large File
**Solution**: Split the file into smaller chunks or use command line import which handles large files better.

### Issue: Character Encoding
**Solution**: Ensure the file is UTF-8 encoded before import.

## Tables in Your Database

Based on the SQL file, you should see tables like:
- `blogs`
- `blog_categories`
- `brands`
- `loyalty_points`
- `online_users`
- `product_categories`
- `product_subcategories`
- `settings`
- `tec_customers`
- `tec_products`
- `tec_sales`
- `tec_sale_items`
- And more...

## Next Steps After Import

1. **Verify Data**: Check a few tables to ensure data imported correctly
2. **Check Constraints**: Verify foreign keys and constraints
3. **Update Sequences**: If using SERIAL, update sequences:
   ```sql
   SELECT setval('table_name_id_seq', (SELECT MAX(id) FROM table_name));
   ```
4. **Test Queries**: Run some SELECT queries to verify data integrity
