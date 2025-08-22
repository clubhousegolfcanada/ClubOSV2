# Session Timeout & Auto-Logout Report
Date: 2025-08-22

## Current Configuration

### Token Expiration Settings

| Setting | Value | Location | Applies To |
|---------|-------|----------|------------|
| **JWT Token Expiry** | **30 days** | `src/middleware/auth.ts:35` | All users (customer, operator, admin) |
| **Token Check Interval** | Every 5 minutes | `tokenManager.ts:88` | All logged-in users |
| **Token Refresh Threshold** | 1 hour before expiry | `src/middleware/auth.ts:84` | All users |

### Current Behavior

1. **30-Day Session Duration**
   - Users stay logged in for 30 days from login time
   - Same for ALL roles (customer, operator, admin)
   - No difference between mobile and desktop

2. **Token Monitoring**
   - Frontend checks token validity every 5 minutes
   - If token is expired, user is logged out automatically
   - Shows "Your session has expired. Please log in again." message

3. **Token Auto-Refresh**
   - When token has less than 1 hour remaining, backend automatically issues new token
   - New token is sent in response header `x-new-token`
   - Frontend automatically updates stored token
   - This extends session without user interaction

4. **No Idle Timeout**
   - System does NOT log out users for inactivity
   - Only logs out when token actually expires (after 30 days)
   - No difference in behavior for different user types

## Security Analysis

### Current Risks

1. **Long Session Duration (30 days)**
   - **Risk**: If device is stolen/lost, attacker has 30 days of access
   - **Impact**: High for operator/admin accounts with system access
   - **Mitigation**: Currently none

2. **No Idle Timeout**
   - **Risk**: User leaves browser open, anyone can use their session
   - **Impact**: Medium-High depending on role
   - **Mitigation**: Currently none

3. **Same Duration for All Roles**
   - **Risk**: Admin accounts have same long session as customers
   - **Impact**: High - admin accounts should have shorter sessions
   - **Mitigation**: Currently none

## Industry Best Practices

### Recommended Session Timeouts

| User Type | Idle Timeout | Max Session | Reasoning |
|-----------|--------------|-------------|-----------|
| **Customer** | 2-4 hours | 7-30 days | Balance UX with security |
| **Operator** | 30-60 min | 8-12 hours | Higher privilege = shorter timeout |
| **Admin** | 15-30 min | 4-8 hours | Highest privilege = shortest timeout |
| **Mobile** | Optional longer | Same/Longer | Mobile devices typically more personal |

### Additional Security Measures

1. **Idle Timeout**
   - Log out after period of no activity
   - Warn user before auto-logout (5 min warning)

2. **Remember Me Option**
   - Let users choose between convenience and security
   - Default to shorter session without "Remember Me"

3. **Device Fingerprinting**
   - Detect unusual device/location changes
   - Require re-authentication for suspicious activity

## Recommendations

### Immediate Changes (Priority 1)

1. **Implement Idle Timeout**
   ```
   Customer: 4 hours idle timeout
   Operator: 1 hour idle timeout
   Admin: 30 minutes idle timeout
   ```

2. **Reduce Max Session Duration**
   ```
   Customer: 7 days (with "Remember Me" option for 30 days)
   Operator: 12 hours
   Admin: 8 hours
   ```

3. **Add Session Extension Warning**
   - Show modal 5 minutes before auto-logout
   - Allow user to extend session with one click

### Future Enhancements (Priority 2)

1. **Activity-Based Session Management**
   - Track mouse/keyboard activity
   - Reset idle timer on user interaction

2. **Secure Session Storage**
   - Use httpOnly cookies instead of localStorage
   - Implement CSRF protection

3. **Audit Logging**
   - Log all session timeouts
   - Track unusual session patterns

## Implementation Considerations

### Frontend Changes Needed

1. **Idle Detection**
   - Track user activity (mouse, keyboard, touch)
   - Reset timer on activity
   - Show warning modal before logout

2. **Role-Based Timeouts**
   - Different timeout values based on user.role
   - Store timeout config in environment variables

3. **Session Warning UI**
   - Modal with countdown timer
   - "Stay Logged In" button
   - Auto-logout if no response

### Backend Changes Needed

1. **Configurable Token Expiry**
   - Different expiry times based on role
   - Environment variables for each role

2. **Idle Timeout Endpoint**
   - Track last activity timestamp
   - Validate activity on each request

3. **Session Management API**
   - List active sessions
   - Revoke specific sessions
   - "Log out all devices" option

## Conclusion

The current 30-day session for all users is too long from a security perspective, especially for operator/admin accounts. Implementing role-based session timeouts and idle detection would significantly improve security while maintaining good UX for customers.

**Recommended immediate action**: Implement idle timeout first (easier), then reduce max session duration based on roles.