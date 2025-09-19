# Investigation: 401 Error on /api/messages/unread-count Endpoint

## Summary
The `/api/messages/unread-count` endpoint is returning a 401 (Unauthorized) error in production.

## Key Findings

### 1. Backend Route Configuration
- **Route**: `/api/messages/unread-count`
- **Middleware**:
  - `authenticate` - Validates JWT token from Authorization header
  - `roleGuard(['admin', 'operator', 'support'])` - Restricts access to specific roles
- **Location**: `ClubOSV1-backend/src/routes/messages.ts`

### 2. Authentication Flow Issues

#### Token Check Timing
The `useMessageNotifications` hook checks for unread messages:
- Runs immediately on component mount
- Checks every 30 seconds thereafter
- **Problem**: May run before AuthGuard completes authentication

#### Race Condition
1. `useMessageNotifications` hook fires on mount
2. Checks if user exists and has correct role
3. Attempts API call with `tokenManager.getToken()`
4. **Issue**: Token might not be set yet if AuthGuard is still loading user from storage

### 3. Token Management

#### Frontend Token Handling
- Token stored in localStorage as `clubos_token`
- Retrieved by `tokenManager.getToken()`
- Added to requests via axios interceptor: `Authorization: Bearer ${token}`

#### Potential Issues
1. **Timing**: Hook may fire before token is restored from localStorage
2. **Token Format**: Token validation checks for JWT format but might have issues
3. **Expiration**: Token might be expired but not detected immediately

### 4. Root Causes

#### Primary Cause: Race Condition
The most likely cause is a race condition between:
- AuthGuard restoring authentication state
- useMessageNotifications attempting to check unread messages

#### Secondary Causes
1. **Token Expiration**: Token expired between storage and API call
2. **Role Mismatch**: User role not in allowed list ['admin', 'operator', 'support']
3. **Network Issues**: Token not properly attached to request headers

## Reproduction Steps
1. User logs in successfully
2. Page refresh or navigation triggers component remount
3. `useMessageNotifications` fires immediately
4. API call made before authentication fully restored
5. 401 error returned

## Impact
- Non-critical: Only affects unread message count display
- User experience: May show incorrect unread count initially
- Auto-retry: Hook continues checking every 30 seconds

## Potential Solutions (Not Implemented)

### Solution 1: Add Auth Check Delay
Add a 1-second delay before first check to ensure auth is loaded

### Solution 2: Check Token Before API Call  
Validate token exists and isn't expired before making request

### Solution 3: Add Retry Logic
Retry once after 2 seconds if 401 error occurs

### Solution 4: Use Auth State Loading Flag
Wait for isAuthLoading to be false before starting checks

## Monitoring Recommendations
1. Add more detailed logging around token state when error occurs
2. Track frequency of 401 errors on this endpoint
3. Monitor time between login and first successful unread check
4. Check if error persists after initial retry (30 seconds later)

## Solution Implemented

### Changes Made
1. **Added auth loading check** - Both hooks now check `isAuthLoading` state
2. **Token validation** - Verify token exists and isn't expired before API calls
3. **Initial delay** - 500ms delay on first check to ensure auth is settled
4. **Retry logic** - Automatically retry once after 2 seconds on 401 errors
5. **Reset mechanism** - Retry count resets on successful calls

### Files Modified
- `/src/hooks/useMessageNotifications.ts` - Primary hook for unread notifications
- `/src/contexts/MessagesContext.tsx` - Context provider for messages state

### How It Works
1. Checks if auth is still loading (`isAuthLoading`)
2. Validates token exists and isn't expired
3. Waits 500ms on initial load for auth to settle
4. If 401 occurs, retries once after 2 seconds
5. Stops retrying after 2 attempts to prevent infinite loops

## Conclusion
The 401 error has been fixed by implementing proper auth state checking and retry logic. The unread message checks now wait for authentication to be fully loaded before making API calls, preventing the race condition that was causing the 401 errors.
