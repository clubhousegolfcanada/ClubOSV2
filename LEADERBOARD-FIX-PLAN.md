# Leaderboard ClubCoin Display Fix Plan

## Problem Summary
The all-time leaderboard is not showing ClubCoins properly for users like Mike Belair and Alanna Belair, even though they have significant CC balances. Only Dylan Askew appears with coins.

## Root Cause Analysis

### Database Investigation Results
```sql
-- Current data:
Mike Belair:    cc_balance = 100,000,125    total_cc_earned = 0
Alanna Belair:  cc_balance = 500            total_cc_earned = 0  
Dylan Askew:    cc_balance = 100            total_cc_earned = 100
```

### Transaction History
- Mike received 100 million CC via `admin_credit` (admin panel adjustment)
- Alanna received 500 CC via `admin_credit`
- Dylan received 100 CC via `initial_grant` (signup bonus)

### The Bug
The admin CC adjustment endpoint (`/api/admin/cc-adjustments/:userId/adjust`) only updates `cc_balance` but NOT `total_cc_earned`. This causes issues because:
1. The default leaderboard sort is by `total_cc_earned DESC`
2. Users with admin-granted CC have 0 in `total_cc_earned`
3. They appear at the bottom of the leaderboard despite having high balances

## Fix Strategy

### 1. Immediate Fix - Update Admin CC Adjustment
**File**: `/src/routes/admin/ccAdjustments.ts`
- When crediting CC, also update `total_cc_earned`
- When debiting CC, update `total_cc_spent` instead

### 2. Data Correction - Fix Existing Users
Create a migration or script to:
- Calculate correct `total_cc_earned` from transaction history
- Sum all positive transactions (credits, bonuses, winnings)
- Update customer_profiles table

### 3. Long-term Solution
- Use the clubCoinService for ALL CC operations
- Ensure all CC changes go through the service
- Service handles all tracking fields correctly

## Implementation Steps

1. **Fix Admin Adjustment Route**
   ```sql
   -- For credits:
   UPDATE customer_profiles SET 
     cc_balance = cc_balance + amount,
     total_cc_earned = total_cc_earned + amount
   
   -- For debits:
   UPDATE customer_profiles SET
     cc_balance = cc_balance - amount,
     total_cc_spent = total_cc_spent + amount
   ```

2. **Create Data Fix Script**
   ```sql
   -- Calculate correct totals from transaction history
   UPDATE customer_profiles cp
   SET total_cc_earned = (
     SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)
     FROM cc_transactions
     WHERE user_id = cp.user_id
   )
   ```

3. **Test Cases**
   - Admin grants CC → total_cc_earned increases
   - Admin deducts CC → total_cc_spent increases
   - Leaderboard shows correct ordering
   - All users appear with proper CC values

## Affected Users
- Mike Belair (100M CC not tracked)
- Alanna Belair (500 CC not tracked)
- Any other users who received admin adjustments

## Prevention
- Always use clubCoinService for CC operations
- Add database triggers to keep totals in sync
- Add tests for admin CC adjustments
- Monitor for discrepancies between balance and totals