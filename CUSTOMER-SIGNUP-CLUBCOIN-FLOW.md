# Customer Signup & ClubCoin Flow - Complete Documentation

## Overview
This document provides a comprehensive analysis of the customer signup flow, ClubCoin initialization, and leaderboard enrollment for new users in ClubOS v1.14.7.

## Current Implementation Status ✅

### 1. Customer Registration Endpoint
**Location**: `/ClubOSV1-backend/src/routes/auth.ts:16-179`

**Flow**:
1. POST `/api/auth/signup` accepts email, password, name, phone
2. Only allows `role: 'customer'` through public endpoint
3. Checks auto-approval setting (defaults to true)
4. Creates user with hashed password
5. Auto-creates customer profile
6. **Initializes 100 CC signup bonus**
7. Adds to current season leaderboard
8. Returns JWT token if auto-approved

### 2. ClubCoin Initialization
**Location**: `/ClubOSV1-backend/src/routes/auth.ts:94-102`

**Implementation**:
```typescript
// Initialize ClubCoins with 100 CC signup bonus
const { clubCoinService } = await import('../services/clubCoinService');
await clubCoinService.initializeUser(userId, 100);
```

**Service Method**: `/ClubOSV1-backend/src/services/clubCoinService.ts:442-468`
- Creates customer profile if needed
- Sets initial rank to 'house'
- Credits 100 CC as 'initial_grant' type
- Logs transaction with description "Welcome to Clubhouse Challenges!"

### 3. Database Schema

#### Customer Profiles Table
**Migration**: `002_customer_features.sql` & `004_challenges_core.sql`
```sql
customer_profiles:
- user_id (UUID, references Users)
- cc_balance (DECIMAL, DEFAULT 0)
- current_rank (rank_tier, DEFAULT 'house')
- highest_rank_achieved (rank_tier, DEFAULT 'house')
- total_cc_earned (DECIMAL, DEFAULT 0)
- total_cc_spent (DECIMAL, DEFAULT 0)
- total_challenges_played (INTEGER, DEFAULT 0)
- total_challenges_won (INTEGER, DEFAULT 0)
```

#### CC Transactions Table
**Migration**: `004_challenges_core.sql`
```sql
cc_transactions:
- user_id (UUID)
- type (VARCHAR) - includes 'initial_grant'
- amount (DECIMAL)
- balance_before/balance_after (DECIMAL)
- description (TEXT)
- season_id (UUID)
```

#### Seasonal CC Earnings Table
**Migration**: `004_challenges_core.sql`
```sql
seasonal_cc_earnings:
- user_id (UUID)
- season_id (UUID)
- cc_from_wins (DECIMAL, DEFAULT 0)
- cc_from_bonuses (DECIMAL, DEFAULT 0)
- cc_net (DECIMAL, DEFAULT 0)
- challenges_completed (INTEGER, DEFAULT 0)
```

### 4. Season Leaderboard Enrollment
**Location**: `/ClubOSV1-backend/src/routes/auth.ts:104-125`

**Implementation**:
- Checks for active season
- Creates entry in `seasonal_cc_earnings`
- Sets initial values:
  - `cc_from_bonuses`: 100
  - `cc_net`: 100
  - `challenges_completed`: 0

### 5. All-Time Leaderboard
**Location**: `/ClubOSV1-backend/src/routes/leaderboard.ts:71-119`

**Automatic Inclusion**:
- No separate enrollment needed
- Query pulls from `customer_profiles` table
- Shows users where `total_cc_earned > 0`
- New users appear immediately with 100 CC

### 6. Friend System Integration
**Location**: `/ClubOSV1-backend/src/routes/friends.ts`

**Features**:
- Users visible in all-time leaderboard can receive friend requests
- Friend requests can be sent from leaderboard UI
- Privacy settings control profile visibility
- No special initialization needed for new users

## ClubCoin Usage Points

### Transaction Types
1. **initial_grant** - 100 CC signup bonus
2. **stake_lock** - Lock CC for challenge
3. **stake_refund** - Return locked CC
4. **challenge_win** - Winnings from challenge
5. **challenge_loss** - Lost in challenge
6. **bonus** - Achievement/special bonuses
7. **admin_grant** - Admin-granted CC
8. **admin_deduct** - Admin-removed CC

### Key Service Methods
- `clubCoinService.initializeUser(userId, amount)` - New user setup
- `clubCoinService.credit(transaction)` - Add CC
- `clubCoinService.debit(transaction)` - Remove CC
- `clubCoinService.transfer(from, to, amount)` - Challenge payouts
- `clubCoinService.lockStakes(challengeId, ...)` - Lock challenge stakes

## Testing & Verification

### Test Script Available
**Location**: `/ClubOSV1-backend/scripts/test-signup-flow.ts`

**Tests**:
1. ✅ Creates new customer account
2. ✅ Verifies user in database
3. ✅ Checks customer profile with 100 CC
4. ✅ Verifies CC transaction log
5. ✅ Confirms season leaderboard entry
6. ✅ Tests authentication
7. ✅ Validates CC balance API

**Run Test**:
```bash
cd ClubOSV1-backend
npx tsx scripts/test-signup-flow.ts
```

## Potential Issues & Gaps

### 1. ⚠️ No Retroactive CC Grant
**Issue**: Existing customers created before CC system may have 0 balance
**Solution Needed**: Migration script to grant 100 CC to existing customers

### 2. ⚠️ No Duplicate Prevention
**Issue**: If `initializeUser` is called twice, user could get 200 CC
**Current Protection**: Try-catch wrapper prevents signup failure
**Recommendation**: Add check in `initializeUser` to prevent double grants

### 3. ✅ Error Handling
**Status**: Good - Failures in CC initialization don't break signup
**Logs**: Errors logged but signup continues

### 4. ✅ Season Handling
**Status**: Good - Works even if no active season exists

## Production Verification Checklist

### Pre-Deployment
- [ ] Verify active season exists in production
- [ ] Check existing customer accounts for CC balance
- [ ] Backup database before deployment

### Post-Deployment Testing
- [ ] Create test customer account via signup
- [ ] Verify receives 100 CC immediately
- [ ] Check appears in all-time leaderboard
- [ ] Verify in current season leaderboard
- [ ] Test friend request from leaderboard
- [ ] Check CC transaction log for initial_grant
- [ ] Verify can participate in challenges

### Monitoring
- [ ] Watch error logs for CC initialization failures
- [ ] Monitor for duplicate initial_grant transactions
- [ ] Check new user CC balances daily
- [ ] Verify leaderboard updates properly

### Rollback Plan
- [ ] Keep database backup before changes
- [ ] Document any manual CC grants made
- [ ] Have script ready to reverse transactions if needed

## Recommendations

### 1. Add Existing User Migration
Create script to grant 100 CC to existing customers:
```sql
-- Find customers without initial grant
SELECT u.id, u.name, cp.cc_balance
FROM users u
JOIN customer_profiles cp ON cp.user_id = u.id
WHERE u.role = 'customer'
AND NOT EXISTS (
  SELECT 1 FROM cc_transactions 
  WHERE user_id = u.id 
  AND type = 'initial_grant'
);
```

### 2. Add Idempotency Check
Modify `initializeUser` to check for existing grant:
```typescript
// Check if already initialized
const existing = await pool.query(
  "SELECT 1 FROM cc_transactions WHERE user_id = $1 AND type = 'initial_grant'",
  [userId]
);
if (existing.rows.length > 0) return true;
```

### 3. Add Admin Dashboard Metrics
- Total users with CC
- Average CC balance
- New signups today
- Initial grants given

## Summary

The system is **OPERATIONAL** and correctly:
1. ✅ Grants 100 CC to new signups
2. ✅ Adds users to season leaderboard  
3. ✅ Makes users visible in all-time leaderboard
4. ✅ Allows friend requests from leaderboard
5. ✅ Tracks all transactions properly
6. ✅ Sets initial rank to "House"

**Main Concern**: Existing users may not have 100 CC - needs retroactive grant script.