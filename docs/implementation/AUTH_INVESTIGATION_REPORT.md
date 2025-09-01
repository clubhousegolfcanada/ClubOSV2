# Authentication & Session Investigation Report
Date: 2025-08-22

## Issue Description
When signing out of customer account (mikebelair79@gmail.com) and attempting to sign in to operator account (mike@clubhouse247golf.com), the system shows "session expired" and kicks the user out.

## Investigation Findings

### 1. Database Analysis

#### User Accounts Status
- **mike@clubhouse247golf.com**
  - Role: `admin` ✅ (Correct)
  - Status: `active` ✅
  - Successful logins: 182
  - Last login: Today at 18:05:21
  - Has customer profile: YES (with 0 CC balance)

- **mikebelair79@gmail.com**
  - Role: `customer` ✅ (Correct)
  - Status: `active` ✅
  - Successful logins: 46
  - Last login: Today at 16:39:08
  - Has customer profile: YES (with 100 CC balance)

- **No duplicate emails found** ✅
- **All recent auth logs show successful logins** ✅

### 2. Frontend Authentication Flow Issues

#### Problem 1: Token Persistence
- When logging out, the system clears:
  - `clubos_token`
  - `clubos_user`
  - `clubos_view_mode`
- But **doesn't clear role-specific state** that might persist in memory

#### Problem 2: AuthGuard Token Check (Line 59-65 in AuthGuard.tsx)
```javascript
if (tokenManager.isTokenExpired(storedToken)) {
  // Token expired, clear and redirect
  localStorage.removeItem('clubos_user');
  localStorage.removeItem('clubos_token');
  localStorage.removeItem('clubos_view_mode');
  router.push('/login');
}
```
- The AuthGuard may be checking the OLD token from the previous session
- When switching from customer to operator, it might find the customer token and consider it expired

#### Problem 3: Route Guards Conflict
- `enforceOperatorRouteGuard` (index.tsx line 50) runs on operator pages
- If user object still has `role: 'customer'` in memory, it redirects to `/customer/`
- This creates a loop where:
  1. User logs in as operator
  2. Old customer role persists momentarily
  3. Route guard kicks them out
  4. Shows as "session expired"

#### Problem 4: View Mode Persistence
- Login sets view mode based on role (login.tsx lines 106-110):
```javascript
if (user.role === 'customer' || loginMode === 'customer') {
  setViewMode('customer');
} else {
  setViewMode('operator');
}
```
- But logout doesn't properly reset the view mode in Zustand store

### 3. Root Causes Identified

1. **Stale State in Zustand Store**: The logout function clears localStorage but doesn't reset the Zustand store state completely
2. **Race Condition**: AuthGuard checks authentication before the new login completes
3. **Token Manager Not Cleared**: Token manager might still have references to old token
4. **Role-Based Guards Too Aggressive**: They check immediately on mount before state updates

### 4. Why mike@clubhouse247golf.com Has Customer Profile
- The admin account has a customer profile created (possibly for testing)
- This could cause confusion in role detection if the system checks for customer profile existence

## Recommendations (DO NOT IMPLEMENT YET)

### Immediate Fixes Needed:
1. **Enhanced Logout Function**
   - Clear Zustand store completely
   - Reset all auth-related state
   - Clear any cached tokens in memory

2. **Fix AuthGuard Race Condition**
   - Add debounce to auth checking
   - Wait for state to settle before redirecting

3. **Improve Role Guards**
   - Add grace period after login
   - Check for fresh login flag

4. **Token Manager Improvements**
   - Clear all token references on logout
   - Add method to force refresh token state

### Long-term Improvements:
1. **Separate Admin/Operator from Customer Auth**
   - Different localStorage keys for different roles
   - Prevent role confusion

2. **Add Session ID Tracking**
   - Track unique session IDs
   - Invalidate old sessions on new login

3. **Implement Proper State Reset**
   - Create a `resetAuth` function that clears everything
   - Call it on logout AND before new login

## Testing Recommendations

1. Test switching between accounts rapidly
2. Test with browser dev tools open to watch localStorage
3. Test with network throttling to expose race conditions
4. Test logout → login with same role vs different role

## Security Considerations

- No security vulnerabilities found
- Authentication is working correctly at API level
- Issue is purely frontend state management
- No unauthorized access possible (guards are working, just too aggressive)