# Customer Creation Fix Plan

## Investigation Summary

After investigating the customer creation system, I've identified **multiple critical issues** preventing customer account creation both through the admin panel and the signup screen.

## Issues Identified

### 1. Frontend Issues

#### Admin "Add Customer" Tool (`OperationsUsers.tsx`)
- **Password validation mismatch**: Frontend requires uppercase, lowercase, number, and 8+ characters
- **Backend validation mismatch**: Backend requires same but checks differently
- **Role dropdown includes "customer"**: But backend `/auth/users` endpoint validation doesn't allow it

#### Login/Signup Screen (`login.tsx`)
- **Works for signup**: Uses correct `/auth/signup` endpoint
- **Status handling works**: Properly handles auto-approval vs pending approval
- **No major issues found here**

### 2. Backend Issues

#### Admin User Creation Endpoint (`/auth/users` - line 460)
- **Critical Issue**: Validation only allows `['admin', 'operator', 'support', 'kiosk', 'customer']`
- **But database.ts createUser**: Doesn't properly set status field for customers
- **Missing customer profile creation**: Admin endpoint doesn't create customer_profiles entry
- **Missing ClubCoin initialization**: Admin endpoint doesn't grant 100 CC signup bonus

#### Signup Endpoint (`/auth/signup` - line 17)
- **Works correctly**: Properly creates customer with all requirements
- **Creates customer profile**: Line 87-92
- **Initializes ClubCoins**: Line 95-119 with proper error handling
- **Adds to leaderboard**: Line 122-142

### 3. Database Issues

- **Migration 115 exists**: Adds status, signup_date, signup_metadata columns
- **Production baseline (200)**: Has customer role in constraint
- **No structural issues found**

## Root Cause Analysis

The main problem is **the admin user creation endpoint doesn't properly handle customer creation**:

1. It doesn't create the required `customer_profiles` entry
2. It doesn't initialize ClubCoins (100 CC signup bonus)
3. It doesn't add users to the season leaderboard
4. It uses different validation than the signup endpoint

## Fix Plan

### Phase 1: Fix Admin Customer Creation (Backend)

```typescript
// In /auth/users endpoint (line 460+), add after user creation:

// If creating a customer, handle additional setup
if (role === 'customer') {
  // Create customer profile
  await db.query(
    `INSERT INTO customer_profiles (user_id, display_name) 
     VALUES ($1, $2) 
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, name]
  );
  
  // Initialize ClubCoins with signup bonus
  try {
    const { clubCoinService } = await import('../services/clubCoinService');
    await clubCoinService.initializeUser(userId, 100);
  } catch (error) {
    // Rollback on failure
    await db.deleteUser(userId);
    throw new AppError('Failed to initialize customer account', 500);
  }
  
  // Add to current season leaderboard
  const seasonResult = await db.query(
    `SELECT id FROM seasons WHERE status = 'active' LIMIT 1`
  );
  
  if (seasonResult.rows.length > 0) {
    await db.query(
      `INSERT INTO seasonal_cc_earnings 
       (user_id, season_id, cc_from_wins, cc_from_bonuses, cc_lost, cc_net, challenges_completed) 
       VALUES ($1, $2, 0, 100, 0, 100, 0)
       ON CONFLICT (user_id, season_id) DO NOTHING`,
      [userId, seasonResult.rows[0].id]
    );
  }
}
```

### Phase 2: Unify Password Validation

```typescript
// Backend: Change line 465 to match frontend expectations
body('password')
  .isLength({ min: 6 })  // Changed from 8 to 6 to match signup
  .withMessage('Password must be at least 6 characters'),
// Remove the complex regex check for admin creation
```

### Phase 3: Fix Frontend Password Validation

```typescript
// OperationsUsers.tsx line 191-197
// Change validation to match backend (6 chars minimum)
setPasswordValidation({
  minLength: password.length >= 6,  // Changed from 8 to 6
  hasUppercase: /[A-Z]/.test(password),
  hasLowercase: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password)
});
```

### Phase 4: Add Customer to Role Dropdown Default

```typescript
// OperationsUsers.tsx line 44
// Change default role for new users to customer if that's most common
role: 'customer' as 'admin' | 'operator' | 'support' | 'kiosk' | 'customer',
```

## Implementation Steps

1. **Fix backend /auth/users endpoint** to properly handle customer creation
2. **Unify password validation** between frontend and backend
3. **Test admin customer creation** with all required fields
4. **Test signup screen** to ensure it still works
5. **Verify ClubCoins** are properly initialized
6. **Verify customer profiles** are created
7. **Check leaderboard** inclusion

## Testing Checklist

- [ ] Admin can create customer account
- [ ] Customer gets 100 CC signup bonus
- [ ] Customer profile is created
- [ ] Customer appears in leaderboard
- [ ] Customer can login after admin creation
- [ ] Signup screen still works
- [ ] Auto-approval setting works
- [ ] Pending approval workflow works
- [ ] Password validation is consistent
- [ ] Error handling works properly

## Risk Assessment

- **Low Risk**: Changes are additive, won't break existing functionality
- **Database Safe**: No schema changes needed
- **Backward Compatible**: Existing users unaffected
- **Rollback Plan**: Simply revert the code changes if issues arise

## Timeline

- Implementation: 30 minutes
- Testing: 15 minutes
- Total: 45 minutes

## Success Criteria

1. Admin can successfully create customer accounts
2. Customers created by admin have all required data (profile, CC, leaderboard)
3. Signup screen continues to work as expected
4. No regression in existing user management functionality