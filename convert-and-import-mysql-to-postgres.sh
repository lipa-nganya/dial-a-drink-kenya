#!/bin/bash

# Script to convert MySQL dump to PostgreSQL and import
# Usage: ./convert-and-import-mysql-to-postgres.sh [database_name]

set -e

SQL_FILE="/Users/maria/Documents/dial a drink database.sql"
DB_NAME="${1:-dial_a_drink}"
DB_USER="${DB_USER:-${USER}}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "🔄 Converting MySQL dump to PostgreSQL format..."
echo "📁 Source: $SQL_FILE"
echo "🗄️  Target database: $DB_NAME"
echo ""

# Check if file exists
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ File not found: $SQL_FILE"
    exit 1
fi

CONVERTED_FILE="/tmp/dial_a_drink_postgresql_${DB_NAME}.sql"

echo "📝 Converting MySQL syntax to PostgreSQL..."
echo "   This may take a few minutes for large files..."
echo ""

# Use sed and awk for conversion (more reliable than Python for this)
sed -E '
    # Remove MySQL-specific database creation and USE statements
    /^CREATE DATABASE/d
    /^USE /d
    /^SET SQL_MODE/d
    /^SET time_zone/d
    /^SET @OLD_CHARACTER_SET/d
    /^SET NAMES/d
    
    # Replace MySQL-specific syntax
    s/`([^`]+)`/\1/g
    s/ENGINE=InnoDB[^;]*//
    s/ENGINE=MyISAM[^;]*//
    s/DEFAULT CHARSET=[^;]*//
    s/COLLATE=[^;]*//
    s/AUTO_INCREMENT/SERIAL/g
    s/\bTINYINT\b/SMALLINT/g
    s/\bMEDIUMINT\b/INTEGER/g
    s/\bDATETIME\b/TIMESTAMP/g
    s/\bLONGTEXT\b/TEXT/g
    s/\bMEDIUMTEXT\b/TEXT/g
    s/START TRANSACTION/BEGIN/g
    
    # Remove LOCK/UNLOCK TABLES
    /^LOCK TABLES/d
    /^UNLOCK TABLES/d
' "$SQL_FILE" > "$CONVERTED_FILE"

if [ $? -eq 0 ] && [ -f "$CONVERTED_FILE" ]; then
    echo "✅ Conversion complete: $CONVERTED_FILE"
    echo ""
    echo "📦 Creating PostgreSQL database '$DB_NAME'..."
    
    # Create database (drop if exists)
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;" || {
        echo "❌ Failed to create database. Please check PostgreSQL is running and you have permissions."
        echo "   You can try: psql -U $DB_USER -d postgres -c \"CREATE DATABASE $DB_NAME;\""
        exit 1
    }
    
    echo "✅ Database created"
    echo ""
    echo "⏳ Importing data (this may take 10-30 minutes for large databases)..."
    echo "   Progress will be shown below..."
    echo ""
    
    # Import with error handling
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$CONVERTED_FILE" 2>&1 | tee /tmp/import_${DB_NAME}.log | grep -E "(ERROR|WARNING|CREATE|INSERT|ALTER)" | head -100
    
    IMPORT_EXIT_CODE=${PIPESTATUS[0]}
    
    echo ""
    if [ $IMPORT_EXIT_CODE -eq 0 ]; then
        echo "✅ Import completed successfully!"
        echo "📊 Database '$DB_NAME' is ready to use"
        echo ""
        echo "📈 Checking database stats..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt" 2>/dev/null | head -20
    else
        echo "⚠️  Import completed with some errors"
        echo "   Check /tmp/import_${DB_NAME}.log for details"
        echo "   Some MySQL-specific features may need manual adjustment"
        echo ""
        echo "   Common issues to fix manually:"
        echo "   - MySQL functions that don't exist in PostgreSQL"
        echo "   - Data type incompatibilities"
        echo "   - Character set/collation issues"
    fi
    
    # Cleanup
    echo ""
    read -p "Delete converted file? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "$CONVERTED_FILE"
        echo "✅ Converted file deleted"
    else
        echo "📁 Converted file kept at: $CONVERTED_FILE"
    fi
else
    echo ""
    echo "❌ Conversion failed. Please check the errors above."
    exit 1
fi
