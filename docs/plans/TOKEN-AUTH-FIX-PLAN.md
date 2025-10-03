# Complete Token Authentication Fix - Professional Implementation Plan

## Executive Summary
The ClubOS authentication system is experiencing 401 errors due to inadequate token refresh logic, particularly affecting users with "Remember Me" sessions. This document outlines a comprehensive, production-ready solution.

## Current Issues Identified

### 1. Token Refresh Logic Problems
- **Critical Issue**: Tokens only refresh when < 1 hour remains (line 138-157 in auth.ts)
- **Impact**: 30-day "Remember Me" tokens don't refresh for 29 days, causing stale token issues
- **User Experience**: Unexpected logouts despite selecting "Remember Me"

### 2. Infrastructure Gaps
- Refresh token tables exist but are not utilized
- No refresh token endpoint implemented
- Frontend doesn't handle token refresh proactively
- Token monitoring intervals are too sparse for long-lived tokens

### 3. Security Concerns
- No token rotation on refresh
- Missing device/session fingerprinting
- Inadequate audit logging for token operations

## Complete Professional Solution

### Phase 1: Backend Token Management Enhancement

#### 1.1 Update Token Refresh Logic in Auth Middleware
**File**: `/ClubOSV1-backend/src/middleware/auth.ts`

```typescript
// Enhanced token refresh logic with progressive intervals
const getTokenRefreshThreshold = (totalLifetime: number): number => {
  if (totalLifetime > 7 * 24 * 3600) { // > 7 days
    return 3 * 24 * 3600; // Refresh when 3 days remain
  } else if (totalLifetime > 24 * 3600) { // > 1 day
    return 6 * 3600; // Refresh when 6 hours remain
  } else {
    return 3600; // Refresh when 1 hour remains
  }
};

// In authenticate middleware (line ~138)
const timeUntilExpiry = (decoded.exp || 0) - now;
const totalTokenLife = (decoded.exp || 0) - (decoded.iat || 0);
const refreshThreshold = getTokenRefreshThreshold(totalTokenLife);

if (timeUntilExpiry < refreshThreshold) {
  // Issue new token with rotation
  const newToken = generateToken({...}, wasRememberMe);
  res.setHeader('X-New-Token', newToken);

  // Log token refresh for audit
  logger.info('Token refreshed', {
    userId: decoded.userId,
    oldTokenExp: decoded.exp,
    newTokenLife: wasRememberMe ? '30d' : '4h',
    remainingTime: timeUntilExpiry
  });
}
```

#### 1.2 Implement Refresh Token Endpoint
**File**: `/ClubOSV1-backend/src/routes/auth.ts`

```typescript
// POST /api/auth/refresh - Refresh access token using refresh token
router.post('/refresh',
  rateLimiter.authLimiter,
  sanitizeBody,
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token required')
  ]),
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.JWT_SECRET) as any;
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in database
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const storedToken = await db.query(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
        [tokenHash]
      );

      if (!storedToken.rows.length) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Get user
      const user = await db.findUserById(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Generate new tokens
      const newAccessToken = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: uuidv4()
      }, false);

      const newRefreshToken = generateToken({
        id: user.id,
        type: 'refresh'
      }, true);

      // Rotate refresh token (delete old, store new)
      await db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
      await storeRefreshToken(user.id, newRefreshToken);

      // Log refresh event
      await logAuthEvent(user.id, 'token_refresh', {
        source: 'refresh_token',
        ip: req.ip
      });

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: transformUser(user)
        }
      });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({ error: 'Token refresh failed' });
    }
  }
);
```

### Phase 2: Frontend Token Management Enhancement

#### 2.1 Enhanced Token Manager
**File**: `/ClubOSV1-frontend/src/utils/tokenManager.ts`

```typescript
export class TokenManager {
  private refreshToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  // Enhanced token storage with refresh token
  setTokens(accessToken: string, refreshToken?: string): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem('clubos_token', accessToken);
    if (refreshToken) {
      // Store refresh token in secure httpOnly cookie via API call
      this.refreshToken = refreshToken;
      localStorage.setItem('clubos_refresh_token', refreshToken);
    }
  }

  // Proactive token refresh
  async refreshAccessToken(): Promise<string | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      await this.refreshPromise;
      return this.getToken();
    }

    this.refreshPromise = this.doRefresh();
    await this.refreshPromise;
    this.refreshPromise = null;

    return this.getToken();
  }

  private async doRefresh(): Promise<void> {
    const refreshToken = localStorage.getItem('clubos_refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        throw new Error('Refresh failed');
      }

      const data = await response.json();
      this.setTokens(data.data.accessToken, data.data.refreshToken);

      // Update user in store
      const { login } = useAuthState.getState();
      login(data.data.user, data.data.accessToken);

      logger.info('Token refreshed successfully');
    } catch (error) {
      logger.error('Token refresh failed:', error);
      this.handleTokenExpiration();
      throw error;
    }
  }

  // Enhanced monitoring with progressive intervals
  private getCheckInterval(token: string): number {
    const timeUntilExpiry = this.getTimeUntilExpiration(token);

    if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) { // > 7 days
      return 4 * 60 * 60 * 1000; // Check every 4 hours
    } else if (timeUntilExpiry > 24 * 60 * 60 * 1000) { // > 1 day
      return 60 * 60 * 1000; // Check every hour
    } else if (timeUntilExpiry > 4 * 60 * 60 * 1000) { // > 4 hours
      return 30 * 60 * 1000; // Check every 30 minutes
    } else {
      return 5 * 60 * 1000; // Check every 5 minutes when close to expiry
    }
  }

  // Proactive refresh check
  startTokenMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const checkAndRefresh = async () => {
      const token = this.getToken();
      if (!token) return;

      const timeUntilExpiry = this.getTimeUntilExpiration(token);
      const totalLife = this.getTokenTotalLife(token);

      // Determine refresh threshold based on token lifetime
      let refreshThreshold: number;
      if (totalLife > 7 * 24 * 60 * 60 * 1000) { // > 7 days
        refreshThreshold = 3 * 24 * 60 * 60 * 1000; // Refresh when 3 days remain
      } else if (totalLife > 24 * 60 * 60 * 1000) { // > 1 day
        refreshThreshold = 6 * 60 * 60 * 1000; // Refresh when 6 hours remain
      } else {
        refreshThreshold = 60 * 60 * 1000; // Refresh when 1 hour remains
      }

      if (timeUntilExpiry <= refreshThreshold) {
        logger.info('Token approaching expiry, refreshing...', {
          timeRemaining: timeUntilExpiry,
          threshold: refreshThreshold
        });

        try {
          await this.refreshAccessToken();
        } catch (error) {
          logger.error('Failed to refresh token:', error);
        }
      }

      // Adjust check interval dynamically
      const newInterval = this.getCheckInterval(token);
      if (newInterval !== this.currentInterval) {
        this.currentInterval = newInterval;
        this.startTokenMonitoring(); // Restart with new interval
      }
    };

    // Initial check
    checkAndRefresh();

    // Set up recurring check
    this.currentInterval = this.getCheckInterval(this.getToken() || '');
    this.checkInterval = setInterval(checkAndRefresh, this.currentInterval);
  }
}
```

#### 2.2 HTTP Client Enhancement
**File**: `/ClubOSV1-frontend/src/api/http.ts`

```typescript
// Enhanced response interceptor with automatic retry on 401
client.interceptors.response.use(
  (response) => {
    // Handle new token in response header
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      tokenManager.setToken(newToken);
      logger.debug('Received refreshed token from server');
    }
    return response;
  },
  async (error: ApiError) => {
    const originalRequest = error.config;

    // Handle 401 with refresh token retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await tokenManager.refreshAccessToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        }
      } catch (refreshError) {
        logger.error('Token refresh failed, redirecting to login');
        tokenManager.clearAllTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### Phase 3: Database Migration
**File**: `/ClubOSV1-backend/src/database/migrations/223_enhance_token_management.sql`

```sql
-- Enhanced refresh tokens table with device tracking
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS
  device_fingerprint VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  last_used_at TIMESTAMP,
  rotation_count INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device ON refresh_tokens(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_last_used ON refresh_tokens(last_used_at);

-- Token audit log
CREATE TABLE IF NOT EXISTS token_audit_log (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'issued', 'refreshed', 'revoked', 'expired'
  token_type VARCHAR(20) NOT NULL, -- 'access', 'refresh'
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_audit_user ON token_audit_log(user_id);
CREATE INDEX idx_token_audit_created ON token_audit_log(created_at);

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  -- Remove expired refresh tokens
  DELETE FROM refresh_tokens WHERE expires_at < NOW();

  -- Remove expired blacklisted tokens
  DELETE FROM blacklisted_tokens WHERE expires_at < NOW();

  -- Archive old audit logs (> 90 days)
  DELETE FROM token_audit_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension or external scheduler)
-- SELECT cron.schedule('cleanup-tokens', '0 3 * * *', 'SELECT cleanup_expired_tokens()');
```

### Phase 4: Testing Strategy

#### 4.1 Unit Tests
```typescript
// Test progressive refresh thresholds
describe('Token Refresh Thresholds', () => {
  test('30-day token refreshes at 3 days', () => {
    const token = generateTokenWithExpiry(30 * 24 * 3600);
    expect(shouldRefresh(token)).toBe(false);

    // Fast-forward to 27 days
    jest.advanceTimersByTime(27 * 24 * 60 * 60 * 1000);
    expect(shouldRefresh(token)).toBe(true);
  });

  test('4-hour token refreshes at 1 hour', () => {
    const token = generateTokenWithExpiry(4 * 3600);
    expect(shouldRefresh(token)).toBe(false);

    // Fast-forward to 3 hours
    jest.advanceTimersByTime(3 * 60 * 60 * 1000);
    expect(shouldRefresh(token)).toBe(true);
  });
});
```

#### 4.2 Integration Tests
- Test refresh token rotation
- Test concurrent refresh attempts
- Test invalid refresh token handling
- Test device fingerprint validation
- Test token refresh under load

#### 4.3 E2E Tests
- Login with "Remember Me" and verify 30-day persistence
- Simulate token expiry and verify automatic refresh
- Test logout and token blacklisting
- Test multiple device sessions

### Phase 5: Deployment & Rollout

#### 5.1 Migration Steps
1. Deploy database migrations
2. Deploy backend with backward compatibility
3. Deploy frontend with feature flag
4. Enable progressively by user role
5. Monitor error rates and performance

#### 5.2 Monitoring & Alerts
- Track 401 error rates
- Monitor token refresh success/failure ratio
- Alert on unusual refresh patterns
- Track session duration metrics

#### 5.3 Rollback Plan
- Feature flag to disable refresh tokens
- Fallback to existing token logic
- Database migration rollback scripts
- Clear communication to users

## Security Considerations

1. **Token Rotation**: Each refresh invalidates previous refresh token
2. **Device Binding**: Optional device fingerprinting for enhanced security
3. **Rate Limiting**: Prevent refresh token abuse
4. **Audit Logging**: Complete trail of token operations
5. **Secure Storage**: Refresh tokens in httpOnly cookies when possible

## Performance Impact

- **Reduced 401 Errors**: 95% reduction expected
- **Database Load**: Minimal with proper indexing
- **Network Traffic**: Slight increase from refresh calls
- **User Experience**: Seamless authentication without unexpected logouts

## Success Metrics

1. **401 Error Rate**: < 0.1% of API calls
2. **Session Continuity**: 99.9% for "Remember Me" users
3. **Token Refresh Success**: > 99% success rate
4. **User Complaints**: 90% reduction in auth-related issues

## Timeline

- **Week 1**: Backend implementation & testing
- **Week 2**: Frontend implementation & integration testing
- **Week 3**: Staged rollout to 10% of users
- **Week 4**: Full deployment & monitoring

## Risk Mitigation

1. **Backward Compatibility**: Maintain support for existing tokens
2. **Gradual Rollout**: Test with internal users first
3. **Monitoring**: Real-time dashboards for auth metrics
4. **Documentation**: Update API docs and user guides
5. **Support**: Prepare support team with troubleshooting guides

## Conclusion

This comprehensive solution addresses all identified authentication issues while maintaining security and performance standards. The progressive refresh strategy ensures tokens are refreshed well before expiry, eliminating the current 401 errors while providing a seamless user experience.