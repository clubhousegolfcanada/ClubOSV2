#!/bin/bash

# Operator Tasks Migration Script
# Run this to add the operator_tasks table to production

set -e  # Exit on error

echo "🔄 Running operator tasks migration..."

# Source the .env file to get DATABASE_URL
if [ -f "./ClubOSV1-backend/.env" ]; then
  export $(grep -v '^#' ./ClubOSV1-backend/.env | xargs)
fi

# Use the Railway DATABASE_URL directly if available
if [ -n "$DATABASE_URL" ]; then
  echo "✅ Using DATABASE_URL from environment"
else
  echo "❌ DATABASE_URL not found!"
  echo "Please set DATABASE_URL environment variable or run 'railway run' prefix"
  exit 1
fi

# Run the migration
echo "📊 Creating operator_tasks table..."

psql "$DATABASE_URL" << 'EOF'
-- Migration: Add operator tasks table for simple task management
-- This creates a lightweight task list for each operator

CREATE TABLE IF NOT EXISTS operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  position INTEGER DEFAULT 0
);

-- Index for fast queries by operator
CREATE INDEX IF NOT EXISTS idx_operator_tasks_user ON operator_tasks(operator_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_created ON operator_tasks(created_at DESC);

-- Check if table was created
SELECT COUNT(*) as table_exists FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'operator_tasks';
EOF

if [ $? -eq 0 ]; then
  echo "✅ Migration completed successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Restart your backend server"
  echo "2. Tasks feature should now be available on the dashboard"
else
  echo "❌ Migration failed!"
  exit 1
fi