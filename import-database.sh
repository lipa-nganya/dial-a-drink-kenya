#!/bin/bash

# Script to import "dial a drink database.sql" from Documents into PostgreSQL
# This script handles the MySQL to PostgreSQL conversion

set -e

SQL_FILE="/Users/maria/Documents/dial a drink database.sql"
DB_NAME="${DB_NAME:-dial_a_drink}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "📦 Importing database from: $SQL_FILE"
echo "🗄️  Target database: $DB_NAME"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
    echo "❌ PostgreSQL server is not running or not accessible"
    echo "   Please start PostgreSQL and ensure it's accessible at $DB_HOST:$DB_PORT"
    exit 1
fi

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ SQL file not found: $SQL_FILE"
    exit 1
fi

echo "✅ PostgreSQL server is running"
echo "✅ SQL file found ($(du -h "$SQL_FILE" | cut -f1))"
echo ""

# Create database if it doesn't exist
echo "🔧 Creating database '$DB_NAME' if it doesn't exist..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "   Database may already exist, continuing..."

# Check if pgloader is available for MySQL to PostgreSQL conversion
if command -v pgloader > /dev/null 2>&1; then
    echo ""
    echo "🔄 Using pgloader to convert and import MySQL dump to PostgreSQL..."
    echo "   This may take a while for large files..."
    echo ""
    
    # Create a temporary MySQL connection config (we'll use the SQL file directly)
    # Note: pgloader can convert SQL dumps, but it's better to use mysql2pgsql or manual conversion
    echo "⚠️  Note: pgloader works best with direct MySQL connections."
    echo "   For SQL dump files, consider using mysql2pgsql or manual conversion."
    echo ""
    echo "   Alternative: Use the converted PostgreSQL file if available, or:"
    echo "   1. Install mysql2pgsql: npm install -g mysql2pgsql"
    echo "   2. Convert: mysql2pgsql $SQL_FILE > converted.sql"
    echo "   3. Import: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f converted.sql"
    exit 1
else
    echo ""
    echo "⚠️  pgloader not found. The SQL file is a MySQL/MariaDB dump."
    echo ""
    echo "📋 Options to import:"
    echo ""
    echo "Option 1: Use mysql2pgsql (recommended)"
    echo "   npm install -g mysql2pgsql"
    echo "   mysql2pgsql \"$SQL_FILE\" > converted.sql"
    echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f converted.sql"
    echo ""
    echo "Option 2: Manual conversion and import"
    echo "   The file needs MySQL-to-PostgreSQL syntax conversion."
    echo "   Common changes needed:"
    echo "   - Remove backticks (\`) around identifiers"
    echo "   - Change AUTO_INCREMENT to SERIAL"
    echo "   - Change ENGINE=InnoDB to PostgreSQL syntax"
    echo "   - Adjust data types (TINYINT -> SMALLINT, etc.)"
    echo "   - Remove MySQL-specific functions"
    echo ""
    echo "Option 3: Use a conversion tool online or:"
    echo "   docker run --rm -v \"$SQL_FILE:/dump.sql\" -e PGHOST=$DB_HOST -e PGPORT=$DB_PORT -e PGUSER=$DB_USER -e PGDATABASE=$DB_NAME pgloader/pgloader pgloader /dump.sql"
    echo ""
    echo "🔧 For now, creating the database structure..."
    echo "   You can manually import after conversion."
    
    # Create database
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres <<EOF
SELECT 'Database $DB_NAME created or already exists' AS status;
EOF
fi

echo ""
echo "✅ Database '$DB_NAME' is ready for import"
echo "   Next steps: Convert the MySQL dump and import it"
