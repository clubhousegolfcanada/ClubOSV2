# Migration 111 Refactor Plan - Tier System Update

## Current Situation

### Problem
- We have 86 migration files total
- Migration 111 fails because it expects old enum values (house, putter, iron, driver) 
- Actual enum values in production are: house, amateur, bronze, silver, gold, pro, champion, legend
- The migration runner tries to run all migrations including duplicates

### Existing Solutions
- There's already a consolidated baseline: `001_consolidated_baseline_v2.sql`
- The refactor plan exists in `/docs/planning/REFACTORING-PLAN.md`

## Solution Approach

### Option 1: Use Fixed Migration (RECOMMENDED)
Use the fixed migration file `111_update_tier_system_fixed.sql` which:
- Correctly maps from the 8 existing tiers to our 5 new tiers
- Handles the actual enum values in production
- Includes proper error checking

**Mapping:**
- house → junior
- amateur → house  
- bronze → house
- silver → amateur
- gold → amateur
- pro → pro
- champion → pro
- legend → master

### Option 2: Skip to Consolidated Baseline
According to the refactor plan:
1. Use `001_consolidated_baseline_v2.sql` as the starting point
2. Mark all migrations before that as "already run"
3. Only run new migrations (102+)

## Implementation Steps

### Step 1: Check Current Migration Status
```bash
DATABASE_URL="postgresql://..." npx tsx src/utils/migrationRunner.ts status
```

### Step 2: Mark Old Migrations as Complete
```sql
-- Add all migrations up to 101 to schema_migrations table
INSERT INTO schema_migrations (version, executed_at)
SELECT 
  LPAD(generate_series::text, 3, '0'),
  NOW()
FROM generate_series(1, 101)
ON CONFLICT (version) DO NOTHING;
```

### Step 3: Run Fixed Migration
```bash
# Run the fixed version
DATABASE_URL="postgresql://..." psql -f 111_update_tier_system_fixed.sql
```

### Step 4: Update Migration Tracking
```sql
INSERT INTO schema_migrations (version, executed_at) 
VALUES ('111_update_tier_system', NOW())
ON CONFLICT (version) DO NOTHING;
```

## Alternative: Full Consolidation (Long-term Solution)

As per the original refactor plan:

### 1. Create New Baseline
- Dump current production schema
- Create single `000_production_baseline.sql`
- Remove all individual migration files

### 2. Reset Migration System
```typescript
// New migration runner that:
// - Checks if baseline exists
// - Only runs migrations after baseline
// - Has proper rollback support
```

### 3. Benefits
- Clean start for new developers
- No more duplicate table errors
- Faster deployment
- Clear schema understanding

## Current Tier System Design

### New 5-Tier Structure
| Tier | Name | CC Required | Old Tiers Mapped |
|------|------|-------------|------------------|
| 1 | Junior | 0-199 | house |
| 2 | House | 200-749 | amateur, bronze |
| 3 | Amateur | 750-1999 | silver, gold |
| 4 | Pro | 2000-4999 | pro, champion |
| 5 | Master | 5000+ | legend |

### Progression Logic
- Average user (5-10 bookings/year @ 25 CC): Reaches House in Year 1
- Active user (20-30 bookings/year): Reaches Amateur in Year 2
- Power user (150 bookings/year): Reaches Pro quickly
- Master tier: Reserved for true elites

## Testing the Migration

### Before Running
```sql
-- Check current enum values
SELECT DISTINCT rank_tier, COUNT(*) 
FROM customer_profiles 
GROUP BY rank_tier;

-- Check if tier_benefits exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'tier_benefits'
);
```

### After Running
```sql
-- Verify new enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'rank_tier')
ORDER BY enumsortorder;

-- Check tier distribution
SELECT rank_tier, COUNT(*) 
FROM customer_profiles 
GROUP BY rank_tier;

-- Verify tier benefits
SELECT * FROM tier_benefits ORDER BY cc_required_min;
```

## Rollback Plan

If migration fails:
```sql
-- Run the DOWN section of the migration
-- This will restore the 8-tier system
```

## Next Steps

1. **Immediate**: Run the fixed migration 111
2. **Short-term**: Mark migrations 1-110 as complete in tracking table
3. **Long-term**: Implement full consolidation plan from REFACTORING-PLAN.md

## Notes

- The migration includes safeguards for missing columns/tables
- It preserves existing data while updating the tier system
- The rollback is fully functional if needed
- Consider running on a test database first