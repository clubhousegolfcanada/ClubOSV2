-- ClubAI Smart Corrections: AI-classified correction tracking + style rules
-- Corrections are auto-classified as factual/tone/brevity/completeness/escalation
-- Factual corrections → clubai_knowledge (existing). Style corrections → clubai_style_rules (new).

-- Style rules learned from operator corrections (injected into system prompt)
CREATE TABLE IF NOT EXISTS clubai_style_rules (
  id SERIAL PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('tone', 'brevity', 'escalation')),
  rule_text TEXT NOT NULL,
  source_correction_id INTEGER,
  example_before TEXT,
  example_after TEXT,
  intent TEXT,                      -- null = applies to all intents
  is_active BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Correction audit log — every correction from conversation monitor lands here
CREATE TABLE IF NOT EXISTS clubai_corrections (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT,
  phone_number TEXT,
  customer_message TEXT,
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('factual', 'tone', 'brevity', 'completeness', 'escalation')),
  correction_summary TEXT,          -- AI-generated: "Changed booking URL" or "Shortened response"
  intent TEXT,
  knowledge_entry_id INTEGER,       -- FK if a knowledge entry was created/updated
  style_rule_id INTEGER,            -- FK if a style rule was created
  corrected_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stats queries and lookups
CREATE INDEX IF NOT EXISTS idx_clubai_corrections_date ON clubai_corrections (created_at);
CREATE INDEX IF NOT EXISTS idx_clubai_corrections_type ON clubai_corrections (correction_type);
CREATE INDEX IF NOT EXISTS idx_clubai_style_rules_active ON clubai_style_rules (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clubai_style_rules_intent ON clubai_style_rules (intent) WHERE is_active = TRUE;
