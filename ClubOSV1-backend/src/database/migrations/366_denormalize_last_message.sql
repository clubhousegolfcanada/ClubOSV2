-- Migration 366: Denormalize last message fields for fast conversation listing
-- Purpose: Eliminate expensive JSONB operations (jsonb_array_length, messages->-1, jsonb_build_array)
--          from the conversation list query. These fields are updated on every message save.
-- Created: 2026-04-02

-- Add denormalized columns
ALTER TABLE openphone_conversations
  ADD COLUMN IF NOT EXISTS last_message_text TEXT,
  ADD COLUMN IF NOT EXISTS last_message_direction VARCHAR(10),
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Index for fast conversation list ordering (the main query)
CREATE INDEX IF NOT EXISTS idx_openphone_conv_last_message_at
  ON openphone_conversations(last_message_at DESC NULLS LAST)
  WHERE phone_number IS NOT NULL AND phone_number != '' AND phone_number != 'Unknown';

-- Backfill from existing JSONB data
UPDATE openphone_conversations
SET
  last_message_text = COALESCE(
    messages->-1->>'body',
    messages->-1->>'text',
    ''
  ),
  last_message_direction = COALESCE(
    messages->-1->>'direction',
    'unknown'
  ),
  last_message_at = COALESCE(
    (messages->-1->>'createdAt')::timestamptz,
    (messages->-1->>'timestamp')::timestamptz,
    updated_at
  ),
  message_count = jsonb_array_length(COALESCE(messages, '[]'::jsonb))
WHERE messages IS NOT NULL AND jsonb_array_length(messages) > 0;

-- Set defaults for empty conversations
UPDATE openphone_conversations
SET
  message_count = 0,
  last_message_at = COALESCE(updated_at, created_at)
WHERE messages IS NULL OR jsonb_array_length(messages) = 0;
