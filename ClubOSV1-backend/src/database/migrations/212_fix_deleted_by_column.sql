-- Migration: Fix deleted_by column in decision_patterns table
-- This ensures the deleted_by column exists and can store user IDs properly

-- UP
-- First, drop the deleted_by column if it exists (might be wrong type)
ALTER TABLE decision_patterns DROP COLUMN IF EXISTS deleted_by;

-- Add deleted_by as text column to match user IDs (which are UUIDs)
ALTER TABLE decision_patterns ADD COLUMN deleted_by TEXT;

-- DOWN
-- Revert to previous state
ALTER TABLE decision_patterns DROP COLUMN IF EXISTS deleted_by;