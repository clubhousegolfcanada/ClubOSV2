-- Add conversation categorization to track which assistant handles each conversation
-- This enables better AI learning and pattern recognition per conversation type

-- Add assistant_type column to openphone_conversations
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS assistant_type VARCHAR(50);

-- Add last_assistant_type to track the most recent routing decision
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS last_assistant_type VARCHAR(50);

-- Add routing_history to track how conversations were routed over time
ALTER TABLE openphone_conversations
ADD COLUMN IF NOT EXISTS routing_history JSONB DEFAULT '[]';

-- Create index for efficient queries by assistant type
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_assistant_type 
  ON openphone_conversations(assistant_type);

-- Create index for queries that need last assistant type
CREATE INDEX IF NOT EXISTS idx_openphone_conversations_last_assistant_type 
  ON openphone_conversations(last_assistant_type);

-- Update existing conversations with a default type based on their messages
-- This is a one-time update to categorize existing data
UPDATE openphone_conversations
SET assistant_type = 'BrandTone',
    last_assistant_type = 'BrandTone'
WHERE assistant_type IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN openphone_conversations.assistant_type IS 'Primary assistant type for this conversation (Emergency, Booking & Access, TechSupport, BrandTone)';
COMMENT ON COLUMN openphone_conversations.last_assistant_type IS 'Most recent assistant type that handled a message in this conversation';
COMMENT ON COLUMN openphone_conversations.routing_history IS 'Array of routing decisions with timestamps and reasons';

-- Create a table to track conversation type statistics
CREATE TABLE IF NOT EXISTS conversation_type_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_type VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  automated_responses INTEGER DEFAULT 0,
  staff_responses INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(assistant_type, date)
);

-- Create indexes for the stats table
CREATE INDEX IF NOT EXISTS idx_conversation_type_stats_date 
  ON conversation_type_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_type_stats_type 
  ON conversation_type_stats(assistant_type);

-- Add trigger to update stats when conversations are updated
CREATE OR REPLACE FUNCTION update_conversation_type_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the updated_at timestamp
  NEW.updated_at = NOW();
  
  -- Add to routing history if assistant type changed
  IF OLD.last_assistant_type IS DISTINCT FROM NEW.last_assistant_type AND NEW.last_assistant_type IS NOT NULL THEN
    NEW.routing_history = NEW.routing_history || jsonb_build_object(
      'timestamp', NOW(),
      'from_type', OLD.last_assistant_type,
      'to_type', NEW.last_assistant_type,
      'message_count', jsonb_array_length(NEW.messages)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversation updates
CREATE TRIGGER update_conversation_routing
  BEFORE UPDATE ON openphone_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_type_stats();