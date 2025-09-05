# Phase 1-2 Cleanup List

## Files to Archive/Remove

### Test Files (Can Archive)
- `/src/test-architecture.ts` - Phase 1 testing file, no longer needed
- `/src/migrations/run-auth-migration.ts` - One-time migration runner
- `/src/migrations/run-auth-migration-safe.ts` - One-time migration runner

### Keep for Reference
- `/src/migrations/001_auth_refactor_tables.sql` - Keep as documentation of tables created
- `/src/routes/test-error.ts` - Keep for error testing

### Original Auth Route (Currently Still Active)
- `/src/routes/auth.ts` - The original 1098 line file
  - Currently still mounted at `/api/auth/*`
  - New refactored version at `/api/v2/auth/*`
  - Should transition frontend to v2 before removing

## Next Steps
1. Transition frontend to use `/api/v2/auth/*` endpoints
2. Once confirmed working in production, archive old `/src/routes/auth.ts`
3. Clean up test files from Phase 1
4. Consider creating `/archive` folder for reference files