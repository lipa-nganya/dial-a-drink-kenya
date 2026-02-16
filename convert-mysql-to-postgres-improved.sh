#!/bin/bash

# Improved MySQL to PostgreSQL conversion script
# Usage: ./convert-mysql-to-postgres-improved.sh olddb

set -e

SQL_FILE="/Users/maria/Documents/dial a drink database.sql"
DB_NAME="${1:-olddb}"
DB_USER="${DB_USER:-${USER}}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "🔄 Improved MySQL to PostgreSQL conversion..."
echo "📁 Source: $SQL_FILE"
echo "🗄️  Target database: $DB_NAME"
echo ""

CONVERTED_FILE="/tmp/dial_a_drink_postgresql_${DB_NAME}_improved.sql"

echo "📝 Converting (this will take a few minutes)..."
echo ""

# More comprehensive conversion
sed -E '
    # Remove MySQL-specific statements
    /^CREATE DATABASE/d
    /^USE /d
    /^SET SQL_MODE/d
    /^SET time_zone/d
    /^SET @OLD_CHARACTER_SET/d
    /^SET NAMES/d
    /^LOCK TABLES/d
    /^UNLOCK TABLES/d
    /^\/\*!40101/d
    /^\/\*!40000/d
    
    # Remove backticks
    s/`([^`]+)`/\1/g
    
    # Convert data types
    s/\bint\([0-9]+\)/INTEGER/g
    s/\bbigint\([0-9]+\)/BIGINT/g
    s/\bsmallint\([0-9]+\)/SMALLINT/g
    s/\btinyint\([0-9]+\)/SMALLINT/g
    s/\bmediumint\([0-9]+\)/INTEGER/g
    s/\bvarchar\(([0-9]+)\)/VARCHAR(\1)/g
    s/\bchar\(([0-9]+)\)/CHAR(\1)/g
    s/\btext\([0-9]+\)/TEXT/g
    s/\bdecimal\(([0-9]+),([0-9]+)\)/DECIMAL(\1,\2)/g
    s/\bdouble\([0-9,]+\)/DOUBLE PRECISION/g
    s/\bfloat\([0-9,]+\)/REAL/g
    
    # Remove MySQL-specific table options
    s/ENGINE=InnoDB[^;]*//
    s/ENGINE=MyISAM[^;]*//
    s/DEFAULT CHARSET=[^;]*//
    s/COLLATE=[^;]*//
    s/AUTO_INCREMENT/SERIAL/g
    
    # Convert timestamps
    s/\bDATETIME\b/TIMESTAMP/g
    s/\bTIMESTAMP\([0-9]+\)/TIMESTAMP/g
    
    # Convert text types
    s/\bLONGTEXT\b/TEXT/g
    s/\bMEDIUMTEXT\b/TEXT/g
    s/\bTINYTEXT\b/TEXT/g
    
    # Transaction statements
    s/START TRANSACTION/BEGIN/g
    
    # Remove DEFAULT current_timestamp() parentheses if needed
    s/DEFAULT current_timestamp\(\)/DEFAULT CURRENT_TIMESTAMP/g
' "$SQL_FILE" > "$CONVERTED_FILE"

echo "✅ Conversion complete"
echo ""

# Create database
echo "📦 Creating database '$DB_NAME'..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || {
    echo "❌ Failed to create database"
    exit 1
}

echo "✅ Database created"
echo ""
echo "⏳ Importing (this will take 15-30 minutes)..."
echo "   Using ON_ERROR_STOP=off to continue past errors..."
echo ""

# Import with error tolerance
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v ON_ERROR_STOP=off \
    -f "$CONVERTED_FILE" \
    2>&1 | tee /tmp/import_${DB_NAME}_improved.log | \
    grep -E "(ERROR|CREATE TABLE|INSERT|ALTER)" | head -200

echo ""
echo "📊 Checking what was imported..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    schemaname,
    COUNT(*) as table_count
FROM pg_tables 
WHERE schemaname = 'public'
GROUP BY schemaname;
" 2>&1

echo ""
echo "✅ Import process completed!"
echo "📁 Log file: /tmp/import_${DB_NAME}_improved.log"
echo "📁 Converted file: $CONVERTED_FILE"
