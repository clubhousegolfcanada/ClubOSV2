-- Migration: ClubAI Draft Responses for Approval Mode
-- Date: 2026-03-23
-- Purpose: Store AI-generated responses as drafts for operator review before sending.

CREATE TABLE IF NOT EXISTS clubai_draft_responses (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  customer_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  confidence FLOAT DEFAULT 0,
  escalate BOOLEAN DEFAULT FALSE,
  escalation_summary TEXT,
  knowledge_ids INTEGER[],
  similarity_scores FLOAT[],
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'edited', 'rejected')),
  operator_response TEXT,            -- What operator actually sent (if edited)
  reviewed_by INTEGER,               -- User ID of reviewer
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubai_drafts_status ON clubai_draft_responses(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_clubai_drafts_conversation ON clubai_draft_responses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_clubai_drafts_created ON clubai_draft_responses(created_at DESC);
