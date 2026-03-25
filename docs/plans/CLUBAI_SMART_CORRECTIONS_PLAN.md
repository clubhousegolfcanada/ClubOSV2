# ClubAI Smart Corrections & Stats Tracking Plan

## Problem
1. Corrections from conversation monitor all get treated identically — factual errors, tone issues, and verbosity problems all create the same type of knowledge entry
2. No stats tracking for corrections/accuracy rate
3. System can't learn style/tone preferences vs factual corrections differently

## Solution: AI-Classified Smart Corrections

### Architecture

When an operator edits an AI response and hits save:

1. **Backend receives**: `{ customerMessage, originalResponse, correctedResponse, intent }`
2. **NEW: AI classifies the correction** by comparing original vs corrected:
   - `factual` — wrong info, wrong link, incorrect price/hours/policy
   - `tone` — too formal, too casual, too nice, robotic language
   - `brevity` — response too long, needs to be shorter
   - `completeness` — missed part of the question, incomplete answer
   - `escalation` — should have escalated (or shouldn't have)
3. **Route to the right storage**:
   - `factual` + `completeness` → `clubai_knowledge` (existing behavior, highest priority)
   - `tone` + `brevity` → NEW `clubai_style_rules` table → injected into system prompt
   - `escalation` → log for analytics, optionally update intent handling rules
4. **Track ALL corrections** in a `clubai_corrections` audit table for stats

### Database Changes (Migration 364)

```sql
-- Style rules learned from corrections (injected into system prompt)
CREATE TABLE IF NOT EXISTS clubai_style_rules (
  id SERIAL PRIMARY KEY,
  rule_type TEXT NOT NULL,          -- 'tone', 'brevity', 'escalation'
  rule_text TEXT NOT NULL,          -- e.g. "Keep pricing responses under 2 sentences"
  source_correction_id INTEGER,     -- FK to clubai_corrections
  example_before TEXT,              -- original response
  example_after TEXT,               -- corrected response
  intent TEXT,                      -- which intent this applies to (null = all)
  is_active BOOLEAN DEFAULT TRUE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Correction audit log (for stats)
CREATE TABLE IF NOT EXISTS clubai_corrections (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT,
  phone_number TEXT,
  customer_message TEXT,
  original_response TEXT NOT NULL,
  corrected_response TEXT NOT NULL,
  correction_type TEXT NOT NULL,     -- 'factual', 'tone', 'brevity', 'completeness', 'escalation'
  correction_summary TEXT,           -- AI-generated: "Changed booking URL from X to Y"
  intent TEXT,
  knowledge_entry_id INTEGER,        -- FK if created a knowledge entry
  style_rule_id INTEGER,             -- FK if created a style rule
  corrected_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add corrections stats to daily tracking
CREATE INDEX idx_clubai_corrections_date ON clubai_corrections (created_at);
CREATE INDEX idx_clubai_corrections_type ON clubai_corrections (correction_type);
CREATE INDEX idx_clubai_style_rules_active ON clubai_style_rules (is_active) WHERE is_active = TRUE;
```

### Backend Changes

#### 1. Enhanced `/clubai-correct` endpoint
- Receives correction from frontend (same payload)
- Calls GPT-4o-mini to classify: `{ type, summary }`
- Routes to appropriate handler:
  - factual/completeness → existing `addManualKnowledge()` flow
  - tone/brevity → creates `clubai_style_rules` entry
  - escalation → logs only
- Always creates `clubai_corrections` audit entry

#### 2. Style rules injection in `clubaiService.ts`
- `generateResponse()` fetches active style rules
- Appends them to system prompt: "STYLE CORRECTIONS FROM THE TEAM: ..."
- Rules are intent-specific or global

#### 3. Enhanced `/clubai-stats` endpoint
- Add: `correctionsToday`, `accuracyRate`
- `accuracyRate = (messagesSent - correctionsTotal) / messagesSent * 100`

### Frontend Changes

#### 1. Stats dashboard
- Add "Corrections" and "Accuracy" to the 4-stat row (becomes 5 or replace Resolution Rate)

#### 2. Correction success message
- Show the AI-detected correction type: "Saved as tone correction — ClubAI will adjust its style"
- Different messaging for factual vs style vs brevity

### NO dropdown needed
- The AI classification happens silently on save
- Operator just edits the text and clicks save (same UX as today)
- Backend figures out what changed and why

## Files to Modify
- `ClubOSV1-backend/src/database/migrations/364_clubai_corrections.sql` (NEW)
- `ClubOSV1-backend/src/routes/enhanced-patterns.ts` (modify clubai-correct, clubai-stats)
- `ClubOSV1-backend/src/services/clubaiService.ts` (inject style rules into prompt)
- `ClubOSV1-backend/src/services/clubaiKnowledgeService.ts` (add style rules functions)
- `ClubOSV1-frontend/src/components/operations/clubai/OperationsClubAI.tsx` (stats display, success message)
