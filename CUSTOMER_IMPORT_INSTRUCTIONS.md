# Customer Import Instructions

## Overview

This document explains how to import customer data from the SQL dump file (`dial a drink database.sql`) into the production database.

## Features

✅ **Phone Number Normalization**: Automatically converts phone numbers to standard format
   - `0727893741` → `254727893741`
   - `254727893741` → `254727893741` (unchanged)
   - Handles various formats (0XXXXXXXXX, 7XXXXXXXX, 254XXXXXXXXX)

✅ **Duplicate Prevention**: Ensures only one customer per normalized phone number
   - `0727893741` and `254727893741` are treated as the same customer
   - Only the first occurrence is imported

✅ **Blank Names Allowed**: Customer names can be blank/null
   - Empty strings are converted to `null`
   - Customers can still log in with phone + OTP + PIN

✅ **OTP + PIN Login Ready**: Imported customers can:
   - Request OTP via phone number
   - Verify OTP
   - Set a 4-digit PIN
   - Login with phone + PIN

## Import Script

**Location**: `backend/scripts/import-customers-from-sql.js`

**Source File**: `/Users/maria/Documents/dial a drink database.sql`

## Usage

### Local Development

```bash
cd backend
node scripts/import-customers-from-sql.js "/Users/maria/Documents/dial a drink database.sql"
```

### Production (via Cloud Run Job)

```bash
# Set variables
PROJECT_ID="dialadrink-production"
REGION="us-central1"
DB_CONNECTION="dialadrink-production:us-central1:dialadrink-db-prod"
SQL_FILE_PATH="/Users/maria/Documents/dial a drink database.sql"

# Create Cloud Run Job
JOB_NAME="import-customers-$(date +%s)"
gcloud run jobs create $JOB_NAME \
  --image gcr.io/$PROJECT_ID/deliveryos-backend:latest \
  --region $REGION \
  --project $PROJECT_ID \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@/dialadrink_prod?host=/cloudsql/$DB_CONNECTION" \
  --set-cloudsql-instances "$DB_CONNECTION" \
  --command "node" \
  --args "scripts/import-customers-from-sql.js" \
  --max-retries 1 \
  --task-timeout 1800 \
  --memory 2Gi \
  --cpu 2

# Upload SQL file to Cloud Storage first (required for Cloud Run)
gsutil cp "$SQL_FILE_PATH" gs://$PROJECT_ID-temp/customers-import.sql

# Note: Cloud Run jobs cannot directly access local files
# You'll need to either:
# 1. Mount the SQL file in the container
# 2. Download it from Cloud Storage in the script
# 3. Use a different approach (see Alternative below)
```

### Alternative: Run via Local Machine with Cloud SQL Proxy

```bash
# Install Cloud SQL Proxy (if not installed)
# https://cloud.google.com/sql/docs/postgres/sql-proxy

# Start Cloud SQL Proxy
cloud-sql-proxy dialadrink-production:us-central1:dialadrink-db-prod &

# Set DATABASE_URL to use localhost
export DATABASE_URL="postgresql://dialadrink_app:PASSWORD@localhost:5432/dialadrink_prod"
export NODE_ENV=production

# Run import
cd backend
node scripts/import-customers-from-sql.js "/Users/maria/Documents/dial a drink database.sql"
```

## What the Script Does

1. **Reads SQL File**: Parses the 500MB+ SQL dump file
2. **Extracts Customer Data**: Finds all `INSERT INTO customers` statements
3. **Normalizes Phone Numbers**: Converts all phone formats to `254XXXXXXXXX`
4. **Removes Duplicates**: Keeps only unique normalized phone numbers
5. **Imports to Database**: Creates customer records with:
   - `phone`: Normalized phone number (e.g., `254727893741`)
   - `username`: Same as phone (for login)
   - `customerName`: From SQL (can be null/blank)
   - `password`: `null` (will be set when customer sets PIN)
   - `hasSetPassword`: `false` (customer needs to set PIN via OTP)

## Expected Results

Based on the SQL file analysis:
- **Total INSERT statements**: 264
- **Unique customers parsed**: ~18,323
- **Import time**: ~10-30 minutes (depending on database performance)

## Customer Login Flow After Import

1. **Customer enters phone number** (e.g., `0727893741` or `254727893741`)
2. **System sends OTP** to the phone
3. **Customer verifies OTP**
4. **Customer sets 4-digit PIN** (if not already set)
5. **Customer can now login** with phone + PIN

## Verification

After import, verify customers were imported:

```sql
-- Check total customers
SELECT COUNT(*) FROM customers;

-- Check customers with blank names
SELECT COUNT(*) FROM customers WHERE "customerName" IS NULL OR "customerName" = '';

-- Check customers with phone numbers
SELECT COUNT(*) FROM customers WHERE phone IS NOT NULL;

-- Sample customers
SELECT id, phone, "customerName", "hasSetPassword" 
FROM customers 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

## Notes

- The script processes customers in batches of 100 to avoid memory issues
- Progress is logged every 100 imports
- Duplicate phone numbers are silently skipped
- Invalid phone numbers are skipped
- Existing customers are updated if they have blank names but the import has a name

## Troubleshooting

### "File too large" error
- The SQL file is 500MB+, ensure you have enough memory
- Consider running on a machine with 4GB+ RAM

### "Database connection failed"
- Check DATABASE_URL is set correctly
- Verify Cloud SQL Proxy is running (if using local connection)
- Check database credentials

### "Duplicate key error"
- This should not happen as the script checks for duplicates
- If it does, the customer already exists - this is expected

### Import is slow
- Normal for 18k+ customers
- Consider running during off-peak hours
- The script processes sequentially to avoid overwhelming the database
