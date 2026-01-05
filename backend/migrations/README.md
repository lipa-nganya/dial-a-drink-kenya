# Database Migrations Guide

This guide explains how to run database migrations on the Cloud SQL instance.

## Prerequisites

1. **Google Cloud SDK** installed and authenticated
2. **Cloud SQL Proxy** installed (optional, for local connection)
3. **Database credentials** (username, password, database name)

## Migration Scripts

The following migrations are available:

1. **add-brands-table.js** - Creates brands table and adds brandId column to drinks table
2. **add-brand-focus.js** - Adds isBrandFocus column to drinks table

## Running Migrations

### Option 1: Using Cloud SQL Proxy (Recommended for Local Development)

1. **Install Cloud SQL Proxy** (if not already installed):
   ```bash
   gcloud components install cloud-sql-proxy
   ```

2. **Start the Cloud SQL Proxy**:
   ```bash
   cloud_sql_proxy -instances=drink-suite:us-central1:drink-suite-db=tcp:5432 &
   ```

3. **Set DATABASE_URL** and run migrations:
   ```bash
   export DATABASE_URL="postgres://username:password@localhost:5432/database_name"
   export NODE_ENV=production
   cd backend
   node scripts/run-cloud-sql-migrations.js
   ```

4. **Stop the proxy** when done:
   ```bash
   pkill cloud_sql_proxy
   ```

### Option 2: Direct Connection (Using Public IP)

If your Cloud SQL instance has a public IP:

```bash
export DATABASE_URL="postgres://username:password@136.111.27.173:5432/database_name"
export NODE_ENV=production
cd backend
node scripts/run-cloud-sql-migrations.js
```

**Note**: Make sure your IP is whitelisted in Cloud SQL authorized networks.

### Option 3: Using Cloud Run Job (Recommended for Production)

1. **Create a Cloud Run Job** that runs the migration script
2. **Set environment variables** in the Cloud Run job:
   - `DATABASE_URL`: Your Cloud SQL connection string
   - `NODE_ENV`: `production`
3. **Execute the job** to run migrations

### Option 4: Using Cloud Build

Create a Cloud Build configuration that:
1. Connects to Cloud SQL
2. Runs the migration script
3. Reports success/failure

## Getting Database Credentials

### From Cloud Run Service

If your backend is deployed on Cloud Run, you can get the DATABASE_URL from the service:

```bash
gcloud run services describe deliveryos-backend \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### From Secret Manager

If credentials are stored in Secret Manager:

```bash
gcloud secrets versions access latest --secret="database-url"
```

### Manual Connection String Format

For Cloud SQL Unix socket:
```
postgres://username:password@/database_name?host=/cloudsql/drink-suite:us-central1:drink-suite-db
```

For TCP connection (with proxy):
```
postgres://username:password@localhost:5432/database_name
```

For Public IP:
```
postgres://username:password@136.111.27.173:5432/database_name
```

## Running Individual Migrations

You can also run migrations individually:

```bash
# Add brands table
NODE_ENV=production DATABASE_URL="your-connection-string" node backend/migrations/add-brands-table.js

# Add brand focus column
NODE_ENV=production DATABASE_URL="your-connection-string" node backend/migrations/add-brand-focus.js
```

## Verification

After running migrations, verify the changes:

```sql
-- Check if brands table exists
SELECT * FROM brands LIMIT 5;

-- Check if brandId column exists in drinks
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'drinks' AND column_name = 'brandId';

-- Check if isBrandFocus column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'drinks' AND column_name = 'isBrandFocus';
```

## Troubleshooting

### Connection Timeout
- Ensure Cloud SQL instance is running
- Check firewall rules allow your IP
- Verify connection string format

### Authentication Failed
- Verify username and password
- Check if user has necessary permissions
- Ensure database exists

### Migration Already Applied
- Migrations are idempotent - they check if changes already exist
- Safe to run multiple times
- Will skip if columns/tables already exist

## Safety Notes

- ✅ Migrations are **idempotent** - safe to run multiple times
- ✅ Migrations check for existing columns/tables before creating
- ✅ No data loss - only adds new columns/tables
- ⚠️ Always backup database before running migrations in production
- ⚠️ Test migrations on a staging environment first





