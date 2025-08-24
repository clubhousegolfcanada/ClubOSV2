# Guide: Adding "Legend" as a 6th Tier

## Current Architecture Overview

The tier system is currently implemented across three layers:
1. **Frontend** - TypeScript types and UI components
2. **Backend** - Some hardcoded references but mostly passes data through
3. **Database** - PostgreSQL enum type that defines valid tiers

## What Would Need to Change

### 1. DATABASE (Most Critical) ✅
**File**: New migration needed

```sql
-- Create migration: 112_add_legend_tier.sql

-- Step 1: Update the enum type
ALTER TYPE rank_tier ADD VALUE 'legend' AFTER 'master';

-- Step 2: Update tier_benefits table
INSERT INTO tier_benefits (
  tier, tier_name, cc_required_min, cc_required_max, 
  booking_discount, early_booking_days, monthly_cc_bonus, perks
) VALUES (
  'legend', 'Legend', 10000, NULL, 
  25, 5, 200, 
  '{"legendary_status": true, "vip_everything": true}'
);

-- Step 3: Update calculate_user_tier function
CREATE OR REPLACE FUNCTION calculate_user_tier(earned_cc INTEGER)
RETURNS rank_tier AS $$
BEGIN
  IF earned_cc >= 10000 THEN
    RETURN 'legend'::rank_tier;
  ELSIF earned_cc >= 5000 THEN
    RETURN 'master'::rank_tier;
  -- rest stays the same...
END;
$$ LANGUAGE plpgsql;
```

### 2. FRONTEND (Multiple Files) 🔧

#### A. Type Definition
**File**: `/ClubOSV1-frontend/src/components/TierBadge.tsx`
```typescript
// Line 4 - Update type
export type TierName = 'junior' | 'house' | 'amateur' | 'pro' | 'master' | 'legend';

// Lines 17-65 - Add legend config
const tierConfigs: Record<TierName, TierConfig> = {
  // ... existing tiers ...
  master: {
    name: 'Master',
    icon: <Sparkles className="w-4 h-4" />,
    bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100',
    borderColor: 'border-amber-400',
    textColor: 'text-amber-900',
    iconColor: 'text-amber-700',
    minCC: 5000,
    maxCC: 9999  // <-- Change this
  },
  legend: {  // <-- Add this
    name: 'Legend',
    icon: <Gem className="w-4 h-4" />,  // Need to import Gem from lucide-react
    bgColor: 'bg-gradient-to-r from-purple-400 to-pink-400',
    borderColor: 'border-purple-600',
    textColor: 'text-white',
    iconColor: 'text-purple-100',
    minCC: 10000
  }
};

// Lines 180-186 - Update calculation
export const calculateTierFromCC = (totalCC: number): TierName => {
  if (totalCC >= 10000) return 'legend';  // <-- Add this
  if (totalCC >= 5000) return 'master';
  if (totalCC >= 2000) return 'pro';
  if (totalCC >= 750) return 'amateur';
  if (totalCC >= 200) return 'house';
  return 'junior';
};

// Line 190 - Update tier order
const tierOrder: TierName[] = ['junior', 'house', 'amateur', 'pro', 'master', 'legend'];
```

#### B. Tier Notifications
**File**: `/ClubOSV1-frontend/src/utils/tierNotifications.ts`
```typescript
// Lines 59-65 - Update calculation (same as above)
export const calculateTierFromCC = (totalCC: number): TierName => {
  if (totalCC >= 10000) return 'legend';
  // ... rest
};

// Lines 68-75 - Update levels
const getTierLevel = (tier: TierName): number => {
  const levels: Record<TierName, number> = {
    junior: 1,
    house: 2,
    amateur: 3,
    pro: 4,
    master: 5,
    legend: 6  // <-- Add this
  };
  return levels[tier] || 1;
};

// Line 79 - Update thresholds
const thresholds = [200, 750, 2000, 5000, 10000];  // <-- Add 10000

// Lines 91-96 - Update next tier mapping
const nextTier: Record<TierName, string | null> = {
  junior: 'House',
  house: 'Amateur',
  amateur: 'Pro',
  pro: 'Master',
  master: 'Legend',  // <-- Change from null
  legend: null  // <-- Add this
};
```

### 3. BACKEND (Minimal Changes) ✅

The backend mostly passes data through and doesn't have hardcoded tier logic, except for:

#### A. Default Values
**Files to check**:
- `/ClubOSV1-backend/src/routes/challenges.ts` (line 346)
- `/ClubOSV1-backend/src/routes/admin/ccAdjustments.ts` (line 133)
- `/ClubOSV1-backend/src/routes/friends.ts` (line 127)

These have default 'house' values but don't need changes for adding legend.

#### B. Season Reset Logic (Optional)
**File**: `/ClubOSV1-backend/src/jobs/seasonalReset.ts`
```typescript
// Lines 163-170 - Add legend rewards if desired
if (performer.rank_tier === 'legend') {
  ccBonus = 500;  // Huge bonus for legends
  description = 'Legendary performance bonus';
} else if (performer.rank_tier === 'master') {
  ccBonus = 200;
  description = 'Master rank bonus';
}
// ... rest of existing logic
```

## Implementation Steps

### Step 1: Database Migration
```bash
# Create and run the migration
cd ClubOSV1-backend
npm run db:migrate
```

### Step 2: Update Frontend Files
1. Update `TierBadge.tsx` with new type and config
2. Update `tierNotifications.ts` with new thresholds
3. Import `Gem` icon from lucide-react in TierBadge.tsx

### Step 3: Test
```bash
# Test frontend build
cd ClubOSV1-frontend
npm run build

# Test with a user having 10,000+ CC
# Should see Legend badge
```

## Summary

### Files to Modify:
1. **New file**: `/ClubOSV1-backend/src/database/migrations/112_add_legend_tier.sql`
2. `/ClubOSV1-frontend/src/components/TierBadge.tsx`
3. `/ClubOSV1-frontend/src/utils/tierNotifications.ts`
4. `/ClubOSV1-backend/src/jobs/seasonalReset.ts` (optional)

### Key Changes:
- Database enum gets new value
- TypeScript type gets new literal
- UI config gets new tier definition
- Threshold functions get new breakpoint at 10,000 CC

### Benefits of Current Architecture:
✅ **Centralized Logic**: Tier calculation is in reusable functions
✅ **Type Safety**: TypeScript ensures all references are updated
✅ **Database-Driven**: Enum ensures data integrity
✅ **Easy to Extend**: Adding tiers follows clear pattern

### Effort Level: 
**Low** - About 30 minutes of work
- 10 mins: Create and test database migration
- 15 mins: Update frontend files
- 5 mins: Test and verify

The system was well-designed to be extensible! The main work is updating the TypeScript types and adding the visual configuration.