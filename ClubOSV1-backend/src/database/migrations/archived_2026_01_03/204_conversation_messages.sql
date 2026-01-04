-- Migration: Conversation Messages Table
-- Purpose: Store conversation history for GPT-4o context awareness
-- Date: 2025-09-03

CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('customer', 'operator', 'system', 'ai')),
  sender_id VARCHAR(255),
  message_text TEXT NOT NULL,
  message_metadata JSONB,
  
  -- Pattern learning context
  pattern_id INTEGER REFERENCES decision_patterns(id) ON DELETE SET NULL,
  pattern_confidence DECIMAL(3,2),
  ai_reasoning JSONB, -- Stores GPT-4o reasoning for this message
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexing for performance
  CONSTRAINT valid_sender CHECK (sender_type IN ('customer', 'operator', 'system', 'ai'))
);

-- Indexes for efficient querying
CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages(created_at DESC);
CREATE INDEX idx_conversation_messages_pattern_id ON conversation_messages(pattern_id);

-- Function to get recent conversation context
CREATE OR REPLACE FUNCTION get_conversation_context(
  p_conversation_id VARCHAR,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  sender_type VARCHAR,
  message_text TEXT,
  created_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.sender_type,
    cm.message_text,
    cm.created_at
  FROM conversation_messages cm
  WHERE cm.conversation_id = p_conversation_id
  ORDER BY cm.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup old messages (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_conversation_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM conversation_messages 
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Add to pattern_execution_history for tracking
ALTER TABLE pattern_execution_history 
ADD COLUMN IF NOT EXISTS conversation_context JSONB,
ADD COLUMN IF NOT EXISTS gpt4o_reasoning JSONB;

COMMENT ON TABLE conversation_messages IS 'Stores conversation history for GPT-4o context-aware responses';
COMMENT ON COLUMN conversation_messages.ai_reasoning IS 'GPT-4o reasoning output including thought process and next steps';