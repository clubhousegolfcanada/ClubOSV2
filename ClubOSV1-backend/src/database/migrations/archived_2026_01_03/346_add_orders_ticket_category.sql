-- Migration: Add 'orders' category to tickets
-- This adds support for automated supply order tickets from checklists

-- Drop existing constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

-- Add new constraint including 'orders'
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check
  CHECK (category IN ('facilities', 'tech', 'orders'));

-- Success message
DO $$ BEGIN RAISE NOTICE 'Added orders category to tickets'; END $$;
