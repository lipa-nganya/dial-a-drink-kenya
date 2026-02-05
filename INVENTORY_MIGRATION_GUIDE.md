# Inventory Migration Guide

## Overview

This guide helps you migrate inventory data (categories, subcategories, brands, drinks) and images from the old Cloud SQL database to the new production database.

**Source:** `drink-suite-db` (drink-suite project, lipanganya@gmail.com)  
**Target:** `dialadrink-db-prod` (dialadrink-production project, dialadrinkkenya254@gmail.com)

---

## Prerequisites

1. **Database Passwords:**
   - Source database password for user `dialadrink_app`
   - Target database password for user `dialadrink_app` (we already have this: `E7A3IIa60hFD3bkGH1XAiryvB`)

2. **Network Access:**
   - Source database IP must allow connections from your machine
   - Target database IP must allow connections from your machine

3. **Database Users:**
   - Source: `dialadrink_app` on `dialadrink` database
   - Target: `dialadrink_app` on `dialadrink_prod` database

---

## Step 1: Get Source Database Password

If you don't know the source database password, you can reset it:

```bash
gcloud config set account lipanganya@gmail.com
gcloud config set project drink-suite

gcloud sql users set-password dialadrink_app \
  --instance=drink-suite-db \
  --password=NEW_PASSWORD
```

---

## Step 2: Whitelist Your IP (if needed)

If you can't connect, you may need to whitelist your IP address:

```bash
# Get your current IP
MY_IP=$(curl -s ifconfig.me)
echo "Your IP: $MY_IP"

# Add to source database
gcloud sql instances patch drink-suite-db \
  --project drink-suite \
  --authorized-networks=$MY_IP/32

# Add to target database
gcloud sql instances patch dialadrink-db-prod \
  --project dialadrink-production \
  --authorized-networks=$MY_IP/32
```

---

## Step 3: Run Migration

### Option A: Using the Helper Script (Recommended)

```bash
cd backend
./scripts/run-inventory-migration.sh
```

The script will prompt you for:
- Source database password
- Target database password

### Option B: Manual Execution

```bash
cd backend

# Set environment variables
export SOURCE_DATABASE_URL="postgresql://dialadrink_app:SOURCE_PASSWORD@136.111.27.173:5432/dialadrink?sslmode=require"
export TARGET_DATABASE_URL="postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@35.223.10.1:5432/dialadrink_prod?sslmode=require"

# Run migration
node scripts/migrate-inventory-to-production.js
```

---

## What Gets Migrated

The migration script will copy:

1. **Categories** - All categories with images
2. **Subcategories** - All subcategories linked to categories
3. **Brands** - All brands with images
4. **Drinks** - All drinks with:
   - Product information (name, description, price)
   - Images (URLs preserved)
   - Stock levels
   - Availability status
   - Capacity and pricing
   - All other product attributes

---

## Image Handling

**Important:** The migration script preserves image URLs from the source database. 

### If Images are in Cloud Storage:

If your images are stored in Cloud Storage buckets, you'll need to:

1. **Identify source bucket:**
   ```bash
   gcloud storage buckets list --project drink-suite
   ```

2. **Copy images to target bucket:**
   ```bash
   # Create target bucket if needed
   gcloud storage buckets create gs://dialadrink-production-images \
     --project dialadrink-production \
     --location us-central1

   # Copy all images
   gsutil -m cp -r gs://SOURCE_BUCKET/images/* gs://dialadrink-production-images/images/
   ```

3. **Update image URLs** (if bucket name changed):
   - The migration preserves original URLs
   - If bucket names differ, you may need to update URLs after migration

### If Images are External URLs:

If images are external URLs (e.g., Cloudinary, CDN), no action needed - URLs are preserved.

---

## Verification

After migration, verify the data:

```bash
# Connect to target database
gcloud sql connect dialadrink-db-prod \
  --user=dialadrink_app \
  --database=dialadrink_prod \
  --project=dialadrink-production

# Run queries
SELECT COUNT(*) FROM categories;
SELECT COUNT(*) FROM subcategories;
SELECT COUNT(*) FROM brands;
SELECT COUNT(*) FROM drinks;

# Check a few sample records
SELECT id, name, image FROM drinks LIMIT 5;
```

---

## Troubleshooting

### Connection Refused

**Error:** `connect ECONNREFUSED`

**Solution:**
1. Check if IP is whitelisted (see Step 2)
2. Verify database is running: `gcloud sql instances describe INSTANCE_NAME`
3. Check firewall rules

### Authentication Failed

**Error:** `password authentication failed`

**Solution:**
1. Verify password is correct
2. Reset password if needed (see Step 1)
3. Check username matches: `dialadrink_app`

### Foreign Key Constraint Errors

**Error:** `foreign key constraint fails`

**Solution:**
- The migration script handles dependencies (categories → subcategories → brands → drinks)
- If errors occur, check that categories exist before subcategories
- Re-run migration - it uses `ON CONFLICT` to handle duplicates

### SSL Connection Errors

**Error:** `SSL connection required`

**Solution:**
- Ensure `?sslmode=require` is in the connection string
- For Cloud SQL, SSL is required for external connections

---

## Database Connection Details

### Source Database
- **Instance:** `drink-suite-db`
- **Project:** `drink-suite`
- **IP:** `136.111.27.173`
- **Database:** `dialadrink`
- **User:** `dialadrink_app`
- **Connection:** `drink-suite:us-central1:drink-suite-db`

### Target Database
- **Instance:** `dialadrink-db-prod`
- **Project:** `dialadrink-production`
- **IP:** `35.223.10.1`
- **Database:** `dialadrink_prod`
- **User:** `dialadrink_app`
- **Password:** `E7A3IIa60hFD3bkGH1XAiryvB`
- **Connection:** `dialadrink-production:us-central1:dialadrink-db-prod`

---

## Next Steps After Migration

1. **Verify data** in target database
2. **Test API endpoints** to ensure inventory loads correctly
3. **Check images** - verify image URLs work
4. **Update image URLs** if bucket names changed
5. **Test frontend** - ensure products display correctly

---

## Rollback

If something goes wrong, you can:

1. **Clear target tables** (be careful!):
   ```sql
   TRUNCATE drinks, brands, subcategories, categories CASCADE;
   ```

2. **Re-run migration** - the script uses `ON CONFLICT` so it's safe to re-run

---

## Support

If you encounter issues:
1. Check migration script logs
2. Verify database connections
3. Check foreign key constraints
4. Review error messages for specific table/record issues
