#!/bin/bash
# Database Restore Script
# Generated: 2025-08-24T12:24:04.043Z

set -e

echo "🔄 DATABASE RESTORE"
echo "=================="
echo ""
echo "⚠️  WARNING: This will restore the database to the backup state!"
echo "⚠️  All current data will be replaced!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 1
fi

echo ""
echo "1. Loading schema..."
psql $DATABASE_URL -f schema.sql

echo "2. Loading data..."
for file in data_*.sql; do
  if [ -f "$file" ]; then
    echo "   Loading $file..."
    psql $DATABASE_URL -f "$file"
  fi
done

echo "3. Adding foreign keys..."
psql $DATABASE_URL -f foreign_keys.sql

echo "4. Adding indexes..."
psql $DATABASE_URL -f indexes.sql

echo ""
echo "✅ Restore complete!"
