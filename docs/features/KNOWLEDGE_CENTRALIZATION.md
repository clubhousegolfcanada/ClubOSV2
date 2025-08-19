# Knowledge Search Centralization

## What Changed
Centralized all knowledge searches into the `KnowledgeLoader` class, eliminating duplicate search logic across multiple modules.

## Before (Scattered)
- **LocalProvider**: Had its own search logic for knowledge_base + extracted_knowledge
- **IntelligentSOPModule**: Had separate search for extracted_knowledge + embeddings
- **KnowledgeLoader**: Had search methods but they weren't consistently used

## After (Centralized)
All knowledge searches now go through `KnowledgeLoader.unifiedSearch()` which:
1. Searches static knowledge base table
2. Searches extracted knowledge table
3. Searches SOP embeddings table
4. Falls back to JSON files if database unavailable
5. Returns results sorted by confidence

## Benefits
- **Single source of truth** for knowledge search logic
- **Consistent behavior** across all modules
- **Easier maintenance** - update search logic in one place
- **Better performance** - parallel searches across all sources
- **Clear visibility** - know exactly where knowledge comes from

## Usage
```typescript
// Search all knowledge sources
const results = await knowledgeLoader.unifiedSearch('7iron tips', {
  includeStatic: true,
  includeExtracted: true,
  includeSOPEmbeddings: true,
  category: 'tech', // or use assistant: 'TechSupport'
  limit: 10,
  minConfidence: 0.6
});
```

## Files Modified
1. `/ClubOSV1-backend/src/knowledge-base/knowledgeLoader.ts` - Added unifiedSearch method
2. `/ClubOSV1-backend/src/services/intelligentSOPModule.ts` - Now uses knowledgeLoader
3. `/ClubOSV1-backend/src/services/llm/LocalProvider.ts` - Now uses knowledgeLoader

This ensures that ALL knowledge you upload (whether through extraction, direct import, or static configuration) will be searchable by the system.