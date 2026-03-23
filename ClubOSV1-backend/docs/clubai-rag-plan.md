# ClubAI RAG System — Implementation Plan

## Goal
Replace ClubAI's static 135-line knowledge base with a dynamic RAG (Retrieval-Augmented Generation) system that searches:
1. **Past conversations** — 1,614 Quo conversations showing how the team actually responds
2. **Website content** — How-to, pricing, coaching, FAQ pages from clubhouse247golf.com

## Architecture

```
Customer SMS → OpenPhone webhook → ClubAI Service
                                      ↓
                              1. Embed customer message (text-embedding-3-small)
                              2. Search clubai_knowledge table (cosine similarity)
                                 - Past conversations (top 5 matches)
                                 - Website content (top 3 matches)
                              3. Build dynamic prompt:
                                 - System prompt (tone/rules/escalation)
                                 - Matched past conversations as examples
                                 - Matched website content as reference
                                 - Conversation history (last 10 messages)
                              4. GPT-4o generates response grounded in real data
```

## Database

### New table: `clubai_knowledge`
- `id` SERIAL PRIMARY KEY
- `source_type` VARCHAR — 'conversation', 'website', 'manual'
- `intent` VARCHAR — sim_frozen, pricing, door_access, etc.
- `customer_message` TEXT — What the customer asked
- `team_response` TEXT — How the team responded
- `source_url` TEXT — Website URL or conversation ID
- `location` VARCHAR — Location if applicable
- `metadata` JSONB — Extra context (resolution, page_title, etc.)
- `embedding` FLOAT[] — 1536-dim vector
- `confidence_score` FLOAT — Quality weight (0-1)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

Reuse existing `cosine_similarity()` function and `find_similar_knowledge()` pattern.

### New table: `clubai_knowledge_search_log`
- Tracks what knowledge was retrieved for each AI response (for debugging/improvement)

## Implementation Steps

### Step 1: Migration (360_clubai_knowledge.sql)
- Create clubai_knowledge table
- Create cosine_similarity function (if not exists)
- Create find_similar_knowledge() function
- Create search log table

### Step 2: ClubAI Knowledge Service (clubaiKnowledgeService.ts)
- `generateEmbedding(text)` — Call OpenAI text-embedding-3-small
- `searchKnowledge(query, limit, sourceType?)` — Embed query + cosine search
- `importConversation(conv)` — Extract Q&A pair, embed, store
- `importWebsiteContent(url, content)` — Parse sections, embed, store
- `addManualKnowledge(intent, question, answer)` — Manual entries

### Step 3: Import Script (import-clubai-knowledge.ts)
- Parse conversations_cleaned.json → extract Q&A pairs
- Filter: only conversations with human responses (not just auto-responses)
- Parse website content (4 pages) → split into sections
- Generate embeddings for all entries
- Bulk insert into clubai_knowledge

### Step 4: Update ClubAI Service
- Before calling GPT-4o, search clubai_knowledge
- Inject matched examples into the prompt
- Keep existing safety checks and escalation protocol

## Files to Create/Modify
- CREATE: `src/database/migrations/360_clubai_knowledge.sql`
- CREATE: `src/services/clubaiKnowledgeService.ts`
- CREATE: `src/scripts/import-clubai-knowledge.ts`
- MODIFY: `src/services/clubaiService.ts`
- MODIFY: `src/routes/enhanced-patterns.ts` (add knowledge API endpoints)
