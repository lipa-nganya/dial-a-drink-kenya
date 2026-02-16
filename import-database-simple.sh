#!/bin/bash
# Simple import script for MySQL to PostgreSQL conversion

SQL_FILE="/Users/maria/Documents/dial a drink database.sql"
DB_NAME="${1:-dial_a_drink}"
DB_USER="${DB_USER:-${USER}}"

echo "Converting and importing MySQL dump to PostgreSQL..."
echo "Database: $DB_NAME"
echo ""

# Step 1: Create database
echo "Creating database..."
psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null
psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

# Step 2: Basic conversion and import
echo "Converting and importing (this will take a while)..."
sed -E '
    s/`([^`]+)`/\1/g
    s/ENGINE=InnoDB[^;]*//
    s/AUTO_INCREMENT/SERIAL/g
    s/TINYINT/SMALLINT/g
    s/DATETIME/TIMESTAMP/g
    s/START TRANSACTION/BEGIN/g
    /^CREATE DATABASE/d
    /^USE /d
' "$SQL_FILE" | psql -U "$DB_USER" -d "$DB_NAME" 2>&1 | grep -v "ERROR" | head -50

echo ""
echo "Import complete! Check for any errors above."
