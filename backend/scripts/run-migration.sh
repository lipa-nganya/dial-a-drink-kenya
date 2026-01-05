#!/bin/bash
# Script to run database migrations
# Usage: ./scripts/run-migration.sh [migration-file.sql]

set -e

# Check if migration file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <migration-file.sql>"
    echo "Example: $0 migrations/add-driver-location-columns.sql"
    exit 1
fi

MIGRATION_FILE="$1"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file '$MIGRATION_FILE' not found"
    exit 1
fi

# Get database URL from environment or config
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL or configure database connection in .env file"
    exit 1
fi

echo "Running migration: $MIGRATION_FILE"
echo "Database: $DATABASE_URL"

# Run the migration
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo "Migration completed successfully!"

