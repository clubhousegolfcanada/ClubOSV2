# Knowledge Management System Analysis & Fix Plan

## Current System Architecture

### Problem Summary
The knowledge management system has multiple disconnected components:
1. **Knowledge Upload** → Stores in `assistant_knowledge` and `knowledge_audit_log` tables
2. **Knowledge Search** → Searches `extracted_knowledge` and `knowledge_audit_log` tables  
3. **Dashboard AI** → Calls OpenAI directly without checking local knowledge first
4. **AI Automations** → Query assistants directly via OpenAI API, not local database

**Result**: Knowledge you upload is never used by the system.

## Database Tables Overview

### Active Tables
- `assistant_knowledge` - Stores knowledge updates from UI (NOT SEARCHED)
- `knowledge_audit_log` - Audit trail of updates (PARTIALLY SEARCHED)
- `extracted_knowledge` - Knowledge from conversations (SEARCHED)

### Legacy/Disabled Tables  
- `sop_embeddings` - Old vector search system (DISABLED)
- `knowledge_captures` - Old knowledge capture (NOT USED)
- `sop_*` tables - All SOP-related tables (DISABLED)

## Current Flow Problems

### 1. Knowledge Upload Flow (BROKEN)
```
User Input → knowledge-router → Parse with GPT-4 → Store in assistant_knowledge → ❌ NEVER RETRIEVED
```

### 2. Dashboard Request Flow (BYPASSES LOCAL)
```
User Request → /api/llm/request → OpenAI Assistant → Response
                                    ↳ ❌ Never checks local database
```

### 3. AI Automation Flow (BYPASSES LOCAL)
```
OpenPhone Message → AI Automation Service → assistantService.getAssistantResponse() → OpenAI API
                                            ↳ ❌ Never checks local database
```

## The Fix: Step-by-Step Implementation

### Step 1: Create Unified Knowledge Search Service
Create a service that searches ALL knowledge tables in priority order:
1. `assistant_knowledge` (manually uploaded knowledge)
2. `knowledge_audit_log` (recent updates)
3. `extracted_knowledge` (knowledge from conversations)

### Step 2: Modify Request Flow
Update `/api/llm/request` to:
1. First search local knowledge database
2. If high confidence match (>0.7), return local answer
3. If no match or low confidence, fallback to OpenAI

### Step 3: Fix Knowledge Upload
1. Keep natural language processing
2. Store in BOTH `assistant_knowledge` AND a searchable format
3. Add file upload support for .md, .json, .txt files
4. Parse and index uploaded content

### Step 4: Connect to AI Automations
1. Update `aiAutomationService` to check local knowledge first
2. Only query OpenAI if no local match
3. Cache frequent queries for performance

## Implementation Plan

### Phase 1: Fix Knowledge Search (Steps 1-4)
1. ✅ Understand database structure
2. ✅ Fix TypeScript errors
3. ✅ Map current flow
4. 🔄 Document architecture (THIS FILE)
5. Create unified search function
6. Test search with existing data

### Phase 2: Connect to Dashboard (Steps 5-8)
7. Modify LLM request handler
8. Add local knowledge check
9. Implement confidence scoring
10. Add fallback logic

### Phase 3: Fix Upload System (Steps 9-12)
11. Fix natural language upload
12. Add file upload endpoints
13. Create parsing logic
14. Test upload → search flow

### Phase 4: Connect Automations (Steps 13-16)
15. Update AI automation service
16. Test gift card automation
17. Test trackman automation
18. Add response caching

### Phase 5: Polish & Test (Steps 17-20)
19. UI improvements
20. Add debugging tools
21. Performance optimization
22. End-to-end testing

## Quick Test Commands

### Test if knowledge exists in database:
```bash
curl http://localhost:5005/api/knowledge/export | jq '.data.metrics'
```

### Test knowledge search:
```bash
curl -X GET "http://localhost:5005/api/knowledge/search?problem=gift%20card&category=booking"
```

### Test knowledge upload:
```bash
curl -X POST http://localhost:5005/api/knowledge-router/parse-and-route \
  -H "Content-Type: application/json" \
  -d '{"input": "Gift cards can be purchased at https://clubhouse247golf.com/giftcard"}'
```

## Next Immediate Steps

1. **Create unified search service** that checks all tables
2. **Modify dashboard request handler** to check local first
3. **Test with gift card example** since that's your main use case

## Why This Will Work

- Minimal changes to existing code
- Preserves all current functionality
- Adds local knowledge layer before OpenAI
- Can be tested incrementally
- Production-safe (won't break existing system)

## Configuration Needed

For local testing, you need:
1. DATABASE_URL (✅ Already set)
2. OPENAI_API_KEY (Currently commented out - needed for upload parsing)
3. Assistant IDs (Can work without these initially)

For production:
- All above are already configured in Railway

## Success Criteria

The system will be working when:
1. Knowledge uploaded through UI is searchable
2. Dashboard checks local knowledge before OpenAI
3. Gift card automation responds with your custom URL
4. Response time improves (local is faster than OpenAI)
5. Cost reduces (fewer OpenAI API calls)