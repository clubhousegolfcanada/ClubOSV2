-- Create assistant_knowledge table for storing knowledge updates
CREATE TABLE IF NOT EXISTS assistant_knowledge (
  id SERIAL PRIMARY KEY,
  assistant_id VARCHAR(255) NOT NULL,
  route VARCHAR(255) NOT NULL,
  knowledge JSONB NOT NULL,
  version VARCHAR(50) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_assistant_knowledge_assistant_id 
ON assistant_knowledge(assistant_id);

-- Add unique constraint to prevent duplicate assistant entries
ALTER TABLE assistant_knowledge 
ADD CONSTRAINT unique_assistant_id UNIQUE (assistant_id);

-- Comment on table
COMMENT ON TABLE assistant_knowledge IS 'Stores knowledge updates for each AI assistant';
COMMENT ON COLUMN assistant_knowledge.assistant_id IS 'OpenAI Assistant ID';
COMMENT ON COLUMN assistant_knowledge.route IS 'Route name (Emergency, Booking, Tech, Brand)';
COMMENT ON COLUMN assistant_knowledge.knowledge IS 'JSON structure containing all knowledge for the assistant';
COMMENT ON COLUMN assistant_knowledge.version IS 'Version number for tracking updates';