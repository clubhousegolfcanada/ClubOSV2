# Complete Authentication Fix Implementation Plan

## Executive Summary
Fix ClubOS authentication to provide operator-friendly 7-30 day tokens with automatic refresh, eliminating constant login prompts while maintaining security for sensitive operations.

## Current State Analysis

### Problems Identified
1. **Token Expiration**: 4-hour tokens for operators causing frequent logouts
2. **Poor Refresh Logic**: Only refreshes when < 1 hour remains
3. **401 Errors**: Breaking API calls and disrupting workflow
4. **PWA Experience**: Doesn't feel like a native app due to constant logins

### Systems Affected
- **Frontend**: tokenManager.ts, http.ts, login.tsx
- **Backend**: auth.ts middleware, auth routes
- **Database**: Token storage, blacklist tables exist but unused
- **Integrations**: OpenPhone, Slack, NinjaOne use webhooks (not affected)

## Implementation Requirements

### Business Requirements
1. Operators must stay logged in for at least 7 days
2. "Remember Me" should provide 30-day sessions
3. PWA must open instantly without login screens
4. Security for financial/admin operations must be maintained

### Technical Requirements
1. Backward compatible with existing tokens
2. No disruption to webhook integrations
3. Automatic token refresh in background
4. Audit logging for extended sessions
5. Password confirmation for sensitive operations only

## Detailed Implementation Plan

### Phase 1: Backend Token Management

#### 1.1 Update Token Generation
**File**: `ClubOSV1-backend/src/middleware/auth.ts`
**Lines**: 34-67

**Current Code**:
```typescript
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string => {
  let expiresIn: string;

  if (rememberMe) {
    expiresIn = '30d';
  } else {
    switch (payload.role) {
      case 'customer':
        expiresIn = '8h';
        break;
      case 'operator':
      case 'admin':
        expiresIn = '4h';  // <-- PROBLEM: Too short
        break;
      // ...
    }
  }
```

**New Code**:
```typescript
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string => {
  let expiresIn: string;

  if (rememberMe) {
    switch (payload.role) {
      case 'operator':
      case 'admin':
        expiresIn = '30d';  // Operators get month-long tokens
        break;
      case 'customer':
        expiresIn = '90d';  // Customers get 3 months
        break;
      case 'contractor':
        expiresIn = '7d';   // Contractors get weekly
        break;
      case 'kiosk':
        expiresIn = '30d';  // Kiosks stay logged in
        break;
      default:
        expiresIn = '7d';
    }
  } else {
    // WITHOUT Remember Me - still generous
    switch (payload.role) {
      case 'operator':
      case 'admin':
        expiresIn = '7d';   // Full week minimum for operators
        break;
      case 'customer':
        expiresIn = '24h';
        break;
      case 'contractor':
        expiresIn = '8h';
        break;
      case 'kiosk':
        expiresIn = '7d';
        break;
      default:
        expiresIn = '24h';
    }
  }

  // Add token version for future migrations
  const enhancedPayload = {
    ...payload,
    tokenVersion: 2,  // Track token generation version
    issuedAt: Date.now()
  };

  return jwt.sign(enhancedPayload, config.JWT_SECRET as string, {
    expiresIn: expiresIn,
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
};
```

#### 1.2 Fix Token Refresh Logic
**File**: `ClubOSV1-backend/src/middleware/auth.ts`
**Lines**: 138-157

**Current Code**:
```typescript
if (timeUntilExpiry < 3600) {  // Only refreshes with 1 hour left
  // Token will expire soon
```

**New Code**:
```typescript
// Calculate when to refresh based on role and token lifetime
const now = Date.now() / 1000;
const timeUntilExpiry = (decoded.exp || 0) - now;
const totalTokenLife = (decoded.exp || 0) - (decoded.iat || 0);
const tokenAgePercent = ((totalTokenLife - timeUntilExpiry) / totalTokenLife) * 100;

// Aggressive refresh for operators
let shouldRefresh = false;
if (decoded.role === 'operator' || decoded.role === 'admin') {
  // Refresh when 30% lifetime remains (70% consumed)
  shouldRefresh = tokenAgePercent > 70;
} else if (decoded.role === 'customer') {
  // Refresh when 50% lifetime remains
  shouldRefresh = tokenAgePercent > 50;
} else {
  // Others refresh when 80% consumed
  shouldRefresh = tokenAgePercent > 80;
}

// Also force refresh if less than 2 days remain for any role
if (timeUntilExpiry < (2 * 24 * 3600)) {
  shouldRefresh = true;
}

if (shouldRefresh) {
  // Determine if original token was long-lived
  const wasRememberMe = totalTokenLife > 604800; // > 7 days

  const newToken = generateToken({
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    sessionId: decoded.sessionId,
    name: decoded.name,
    phone: decoded.phone
  }, wasRememberMe);

  res.setHeader('X-New-Token', newToken);

  logger.info('Token auto-refreshed', {
    userId: decoded.userId,
    role: decoded.role,
    tokenAgePercent: Math.round(tokenAgePercent),
    daysRemaining: Math.round(timeUntilExpiry / 86400),
    newTokenLife: wasRememberMe ? '30d' : '7d'
  });
}
```

#### 1.3 Add Password Confirmation for Sensitive Ops
**File**: `ClubOSV1-backend/src/middleware/auth.ts`
**Add after line 363**

```typescript
// New middleware for operations requiring fresh authentication
export const requirePasswordConfirmation = (req: Request, res: Response, next: NextFunction) => {
  // List of operations that need password confirmation
  const sensitiveOperations = [
    '/api/users/:id',  // DELETE method only
    '/api/admin/reset',
    '/api/financial/adjust',
    '/api/system/critical'
  ];

  // Check if this is a sensitive operation
  const isSensitive = sensitiveOperations.some(op => {
    const pattern = op.replace(/:id/g, '[^/]+');
    return new RegExp(pattern).test(req.path);
  });

  if (!isSensitive) {
    return next();
  }

  // Check if password was recently confirmed (within 5 minutes)
  const confirmationToken = req.headers['x-password-confirmation'] as string;

  if (!confirmationToken) {
    return res.status(403).json({
      error: 'Password confirmation required',
      code: 'CONFIRM_PASSWORD',
      message: 'This operation requires password confirmation'
    });
  }

  try {
    // Verify the confirmation token
    const decoded = jwt.verify(confirmationToken, config.JWT_SECRET) as any;

    if (decoded.type !== 'password_confirmation' || decoded.userId !== req.user?.id) {
      throw new Error('Invalid confirmation token');
    }

    if (Date.now() / 1000 - decoded.iat > 300) { // 5 minutes
      throw new Error('Confirmation expired');
    }

    next();
  } catch (error) {
    return res.status(403).json({
      error: 'Invalid or expired confirmation',
      code: 'CONFIRM_PASSWORD',
      message: 'Please confirm your password again'
    });
  }
};
```

### Phase 2: Frontend Token Management

#### 2.1 Update Token Manager
**File**: `ClubOSV1-frontend/src/utils/tokenManager.ts`

**Add these methods**:
```typescript
// Get user role from token
getUserRole(token: string): string | null {
  const decoded = this.decodeToken(token);
  return decoded?.role || null;
}

// Get token total lifetime
getTokenTotalLife(token: string): number {
  const decoded = this.decodeToken(token);
  if (!decoded) return 0;
  return (decoded.exp - decoded.iat) * 1000;
}

// Enhanced check interval based on role
private getCheckInterval(token: string): number {
  const timeUntilExpiry = this.getTimeUntilExpiration(token);
  const role = this.getUserRole(token);

  // Operators get more frequent checks
  if (role === 'operator' || role === 'admin') {
    if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) { // > 7 days
      return 2 * 60 * 60 * 1000; // Every 2 hours
    } else if (timeUntilExpiry > 24 * 60 * 60 * 1000) { // > 1 day
      return 30 * 60 * 1000; // Every 30 minutes
    } else {
      return 5 * 60 * 1000; // Every 5 minutes
    }
  }

  // Standard intervals for others
  if (timeUntilExpiry > 30 * 24 * 60 * 60 * 1000) {
    return 8 * 60 * 60 * 1000; // Every 8 hours
  } else if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) {
    return 2 * 60 * 60 * 1000; // Every 2 hours
  } else {
    return 30 * 60 * 1000; // Every 30 minutes
  }
}
```

**Update `startTokenMonitoring` method**:
```typescript
startTokenMonitoring(): void {
  if (this.checkInterval) {
    clearInterval(this.checkInterval);
  }

  const checkAndRefresh = async () => {
    const token = this.getToken();
    if (!token || this.isTokenExpired(token)) return;

    const role = this.getUserRole(token);
    const timeUntilExpiry = this.getTimeUntilExpiration(token);

    // Log token status for monitoring
    logger.debug('Token status check', {
      role,
      hoursRemaining: Math.round(timeUntilExpiry / (60 * 60 * 1000)),
      willCheckAgainIn: this.currentInterval / 1000 / 60 + ' minutes'
    });

    // Make a lightweight API call to trigger backend refresh if needed
    if (role === 'operator' || role === 'admin') {
      try {
        // This call will trigger backend to check and refresh token
        await http.get('/system/health');
      } catch (error) {
        // Ignore errors - this is just a refresh trigger
      }
    }
  };

  // Initial check after 1 minute
  setTimeout(checkAndRefresh, 60000);

  // Set up recurring checks
  const token = this.getToken();
  if (token) {
    this.currentInterval = this.getCheckInterval(token);
    this.checkInterval = setInterval(checkAndRefresh, this.currentInterval);
  }
}
```

#### 2.2 Update HTTP Client
**File**: `ClubOSV1-frontend/src/api/http.ts`

**Update response interceptor** (line 92):
```typescript
client.interceptors.response.use(
  (response) => {
    // Handle new token from backend
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      tokenManager.setToken(newToken);

      // Update auth state
      const { user } = useAuthState.getState();
      if (user) {
        useAuthState.setState({ token: newToken });
      }

      logger.info('Token refreshed automatically', {
        endpoint: response.config.url
      });
    }
    return response;
  },
  async (error: ApiError) => {
    // Handle password confirmation requirement
    if (error.response?.status === 403 &&
        error.response?.data?.code === 'CONFIRM_PASSWORD') {
      // Trigger password confirmation UI
      const confirmed = await promptPasswordConfirmation();
      if (confirmed) {
        // Retry with confirmation token
        error.config.headers['X-Password-Confirmation'] = confirmed;
        return client(error.config);
      }
    }

    // Existing 401 handling...
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;

      if (currentPath !== '/login' && !currentPath.startsWith('/auth/')) {
        tokenManager.clearToken();
        localStorage.removeItem('clubos_user');
        localStorage.removeItem('clubos_view_mode');

        if (!sessionStorage.getItem('redirecting_to_login')) {
          sessionStorage.setItem('redirecting_to_login', 'true');
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);
```

#### 2.3 Update Login Page
**File**: `ClubOSV1-frontend/src/pages/login.tsx`

**Line 25 - Smart default for Remember Me**:
```typescript
// Detect operator mode and default Remember Me
const [rememberMe, setRememberMe] = useState(true); // Default to true
const [loginMode, setLoginMode] = useState<'operator' | 'customer'>('operator');

// Auto-detect based on email
useEffect(() => {
  if (email) {
    // Check if likely an operator
    const isLikelyOperator =
      email.includes('@clubhouse') ||
      email.includes('admin') ||
      email.includes('operator') ||
      !email.includes('@gmail') && !email.includes('@yahoo');

    if (isLikelyOperator) {
      setLoginMode('operator');
      setRememberMe(true);
    }
  }
}, [email]);
```

**Update Remember Me label** (line 327):
```typescript
<label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--text-secondary)]">
  {loginMode === 'operator'
    ? 'Keep me signed in (30 days)'
    : 'Remember me (90 days)'}
</label>
```

### Phase 3: Database & Monitoring

#### 3.1 Add Token Metrics Table
**File**: `ClubOSV1-backend/src/database/migrations/224_token_metrics.sql`

```sql
-- Track token usage for monitoring
CREATE TABLE IF NOT EXISTS token_metrics (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50),
  action VARCHAR(50), -- 'issued', 'refreshed', 'expired', 'revoked'
  token_lifetime_days INTEGER,
  client_info JSONB, -- user agent, IP, etc
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_metrics_user ON token_metrics(user_id);
CREATE INDEX idx_token_metrics_created ON token_metrics(created_at);
CREATE INDEX idx_token_metrics_action ON token_metrics(action);

-- Function to log token metrics
CREATE OR REPLACE FUNCTION log_token_metric(
  p_user_id UUID,
  p_role VARCHAR(50),
  p_action VARCHAR(50),
  p_lifetime_days INTEGER,
  p_client_info JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO token_metrics (user_id, role, action, token_lifetime_days, client_info)
  VALUES (p_user_id, p_role, p_action, p_lifetime_days, p_client_info);
END;
$$ LANGUAGE plpgsql;
```

### Phase 4: Testing Strategy

#### 4.1 Unit Tests
**File**: `ClubOSV1-backend/src/tests/auth.test.ts`

```typescript
describe('Token Generation', () => {
  test('Operator gets 7-day token without Remember Me', () => {
    const token = generateToken({
      userId: 'test',
      email: 'op@clubhouse.com',
      role: 'operator',
      sessionId: 'test'
    }, false);

    const decoded = jwt.decode(token) as any;
    const lifetime = decoded.exp - decoded.iat;
    expect(lifetime).toBe(7 * 24 * 3600); // 7 days
  });

  test('Operator gets 30-day token with Remember Me', () => {
    const token = generateToken({
      userId: 'test',
      email: 'op@clubhouse.com',
      role: 'operator',
      sessionId: 'test'
    }, true);

    const decoded = jwt.decode(token) as any;
    const lifetime = decoded.exp - decoded.iat;
    expect(lifetime).toBe(30 * 24 * 3600); // 30 days
  });
});

describe('Token Refresh', () => {
  test('Operator token refreshes at 70% lifetime', () => {
    // Create 7-day token
    // Fast forward 5 days (71% consumed)
    // Verify refresh happens
  });
});
```

#### 4.2 Integration Tests
```bash
# Test script: test-auth-flow.sh
#!/bin/bash

# 1. Login as operator with Remember Me
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@clubhouse.com","password":"test","rememberMe":true}'

# 2. Extract token and verify 30-day expiry
# 3. Make API calls and check for X-New-Token header
# 4. Verify token refresh after 70% lifetime
```

### Phase 5: Deployment Checklist

#### Pre-Deployment
- [ ] Backup database
- [ ] Test on staging environment
- [ ] Review all changed files
- [ ] Run TypeScript checks: `npx tsc --noEmit`
- [ ] Run tests

#### Deployment Steps
1. Deploy database migration
2. Deploy backend changes
3. Deploy frontend changes
4. Monitor logs for errors

#### Post-Deployment
- [ ] Verify operators can login
- [ ] Check token lifetimes in logs
- [ ] Monitor 401 error rate
- [ ] Test token refresh
- [ ] Verify sensitive operations require confirmation

## Rollback Plan

If issues occur:
```bash
# 1. Revert git commits
git revert HEAD~3

# 2. Deploy reverted code
git push

# 3. Clear user sessions to force re-login
psql $DATABASE_URL -c "DELETE FROM blacklisted_tokens WHERE created_at > NOW() - INTERVAL '1 hour'"
```

## Monitoring & Success Metrics

### Add Monitoring
```typescript
// In backend auth middleware
logger.info('Auth metrics', {
  event: 'token_issued',
  role: payload.role,
  lifetime_hours: expiresIn,
  remember_me: rememberMe,
  timestamp: new Date().toISOString()
});
```

### Success Criteria
- ✅ 401 errors reduced by 95%
- ✅ Average operator session > 7 days
- ✅ Token refresh success rate > 99%
- ✅ No security incidents
- ✅ Operator satisfaction improved

## Questions to Answer Before Starting

1. **Database Access**: Do you have access to run migrations?
2. **Deployment Process**: Is it git push auto-deploy or manual?
3. **Rollback Process**: Can you quickly revert if needed?
4. **Testing Environment**: Is there a staging environment?
5. **Current Token Status**: Any operators currently logged in who might be affected?
6. **Monitoring Tools**: What logging/monitoring is available?
7. **Critical Times**: Any times to avoid deployment?

## Ready to Implement?

Once these questions are answered, the implementation will:
1. Take approximately 2 hours
2. Be fully backward compatible
3. Immediately improve operator experience
4. Maintain security for sensitive operations

The plan is complete and ready for execution. All code changes are provided with exact file locations and line numbers.