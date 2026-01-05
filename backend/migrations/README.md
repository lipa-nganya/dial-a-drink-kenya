# Database Migrations

This directory contains SQL migration scripts for database schema changes.

## Running Migrations

### Option 1: Using psql (Direct Database Access)

```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration
\i migrations/add-driver-location-columns.sql
```

### Option 2: Using Environment Variables

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run the migration
psql $DATABASE_URL -f migrations/add-driver-location-columns.sql
```

### Option 3: Using Cloud SQL Proxy (For Google Cloud SQL)

```bash
# Start Cloud SQL Proxy
cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE_NAME=tcp:5432 &

# Run migration
psql "host=127.0.0.1 port=5432 dbname=DATABASE_NAME user=USERNAME password=PASSWORD" -f migrations/add-driver-location-columns.sql
```

## Migration Files

- `add-driver-location-columns.sql` - Adds locationLatitude and locationLongitude columns to drivers table

## Notes

- Migrations are idempotent (safe to run multiple times)
- Always backup your database before running migrations
- Test migrations on a staging environment first
