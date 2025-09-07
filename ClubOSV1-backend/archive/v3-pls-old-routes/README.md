# Archived V3-PLS Route Files

**Archived Date**: September 7, 2025  
**Reason**: Consolidated into single enhanced-patterns.ts implementation

## Archived Files

### 1. patterns.ts
- Original main patterns route (80KB)
- Contained core CRUD operations
- Pattern management and queue features
- Statistics and configuration

### 2. patterns-enhanced.ts  
- GPT-4o validation features (10KB)
- Embedding generation
- Semantic search capabilities
- Enhanced pattern creation

### 3. patterns-api.ts
- Pattern recovery features (6KB)
- Admin utilities
- Batch operations

## Replacement

All features from these three files have been consolidated into:
- `/src/routes/enhanced-patterns.ts` - Single unified implementation
- `/src/services/patternSystemService.ts` - Unified service layer

## Features Preserved

✅ All CRUD operations  
✅ GPT-4o validation and enhancement  
✅ Semantic search with embeddings  
✅ Pattern queue management  
✅ Statistics and analytics  
✅ Safety controls  
✅ Pattern recovery  
✅ CSV import  
✅ Configuration management  

## Rollback Instructions

If needed, to rollback:
1. Move these files back to `/src/routes/`
2. Update `/src/index.ts` to import and mount old routes
3. Remove consolidated enhanced-patterns.ts route

## Notes

- The consolidated system is 100% backward compatible
- No features were lost in the consolidation
- Performance improved by reducing duplicate code
- Easier maintenance with single source of truth