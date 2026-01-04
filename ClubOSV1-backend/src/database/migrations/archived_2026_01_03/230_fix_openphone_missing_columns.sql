-- Migration 230: Add missing operator tracking columns to openphone_conversations
-- These columns are required for the Pattern Learning System integration

-- Add operator tracking columns if they don't exist
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS operator_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS operator_last_message TIMESTAMP,
ADD COLUMN IF NOT EXISTS conversation_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS rapid_message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_response_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_openphone_operator_active
ON openphone_conversations(operator_active)
WHERE operator_active = true;

CREATE INDEX IF NOT EXISTS idx_openphone_lockout
ON openphone_conversations(lockout_until)
WHERE lockout_until > NOW();

-- Add comment explaining the columns
COMMENT ON COLUMN openphone_conversations.operator_active IS 'Whether an operator is actively handling this conversation';
COMMENT ON COLUMN openphone_conversations.operator_last_message IS 'Timestamp of last operator message';
COMMENT ON COLUMN openphone_conversations.conversation_locked IS 'Whether conversation is locked from AI responses';
COMMENT ON COLUMN openphone_conversations.lockout_until IS 'Time until which conversation is locked';
COMMENT ON COLUMN openphone_conversations.rapid_message_count IS 'Count of rapid messages for rate limiting';
COMMENT ON COLUMN openphone_conversations.ai_response_count IS 'Count of AI responses sent';