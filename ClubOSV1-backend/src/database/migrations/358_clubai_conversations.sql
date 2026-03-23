-- ClubAI conversational support tracking
-- Adds columns to openphone_conversations to track ClubAI state

ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS clubai_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS clubai_messages_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clubai_escalated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS clubai_escalation_reason TEXT;
