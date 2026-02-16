# Customer Import to Development Environment

## Status

✅ **Backend Deployed**: Customer pagination and search endpoints are live  
✅ **Admin Frontend Deployed**: Customer page with pagination and search is live  
⚠️ **Customer Data Import**: Needs to be run manually (SQL file is local)

## What's Been Deployed

### Backend Changes
- ✅ Pagination support for `/admin/customers` endpoint
- ✅ Search functionality (by name, phone, email, username)
- ✅ Customer name prioritization (shows name instead of phone when available)
- ✅ Customer import script available

### Admin Frontend Changes
- ✅ Pagination (25 customers per page by default)
- ✅ Auto-filtering search as you type (500ms debounce)
- ✅ Search by name, phone, email, or username
- ✅ Improved customer name display

## Customer Data Import

The customer import script needs to be run on the development database. The SQL file (`/Users/maria/Documents/dial a drink database.sql`) is on your local machine.

### Option 1: Run via Cloud Run Job (Recommended)

**Note**: The SQL file needs to be accessible from Cloud Run. You'll need to either:
1. Upload the SQL file to Cloud Storage first, OR
2. Use Cloud SQL Proxy to run locally

**If using Cloud Storage:**
```bash
# Upload SQL file to Cloud Storage
gsutil cp "/Users/maria/Documents/dial a drink database.sql" gs://dialadrink-production-temp/customers-import.sql

# Modify the import script to download from Cloud Storage, then run via Cloud Run Job
```

**If using Cloud SQL Proxy (Local):**
```bash
# Start Cloud SQL Proxy
cloud-sql-proxy dialadrink-production:us-central1:dialadrink-db-prod &

# Set development DATABASE_URL
export DATABASE_URL="postgresql://dialadrink_app:PASSWORD@localhost:5432/dialadrink_prod"
export NODE_ENV=production

# Run import
cd backend
node scripts/import-customers-from-sql.js "/Users/maria/Documents/dial a drink database.sql"
```

### Option 2: Run Import Script Directly

The import script is already deployed with the backend. You can execute it via Cloud Run Job, but you'll need to make the SQL file accessible first.

**Current Job Created:**
- Job Name: `import-customers-dev-1771252824`
- Status: Created, but needs SQL file access

**To Execute (after making SQL file accessible):**
```bash
gcloud run jobs execute import-customers-dev-1771252824 \
  --region us-central1 \
  --project dialadrink-production \
  --wait
```

## Verification

After importing customers, verify:

```bash
# Check total customers
curl https://deliveryos-development-backend-lssctajjoq-uc.a.run.app/api/admin/customers?page=1&limit=10 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check customers with names
# (Should show names instead of phone numbers for customers with names)
```

## Next Steps

1. ✅ Backend deployed with pagination and search
2. ✅ Admin frontend deployed with pagination and search UI
3. ⚠️ **TODO**: Import customer data to development database
   - Upload SQL file to Cloud Storage, OR
   - Use Cloud SQL Proxy to run import locally

## Service URLs

- **Development Backend**: https://deliveryos-development-backend-lssctajjoq-uc.a.run.app
- **Development Admin Frontend**: https://deliveryos-admin-frontend-lssctajjoq-uc.a.run.app
