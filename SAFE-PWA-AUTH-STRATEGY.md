# Safe PWA Authentication Strategy - Considering All Integrations

## Critical Findings - You're Right to Be Cautious

After analyzing the codebase, here are the systems that could be affected by extended tokens:

### 🚨 High-Risk Areas (Need Special Handling)

1. **Financial Operations**
   - ClubCoin transactions and adjustments
   - Challenge wagering system
   - Booking payments (if integrated)
   - Admin CC adjustments endpoint

2. **Third-Party Integrations**
   - **OpenPhone**: Uses webhooks (not affected by user tokens)
   - **Slack**: Uses webhooks and bot tokens (not affected)
   - **NinjaOne**: API key based (not affected)
   - **UniFi Door Access**: Security concern if token compromised
   - **HubSpot**: API key based (not affected)

3. **Security-Sensitive Operations**
   - Door unlock commands (contractor/operator)
   - User management (admin only)
   - Pattern learning configuration
   - System settings modifications

4. **Customer vs Operator Conflicts**
   - Same auth system for very different use cases
   - Customers: Need convenience for challenges/bookings
   - Operators: Need security for facility management

### ✅ Safe Areas (Can Have Extended Tokens)

1. **Read-Only Operations**
   - Viewing messages
   - Checking tickets
   - Reading checklists
   - Viewing leaderboards
   - Dashboard data

2. **Webhook-Based Systems** (Don't use user tokens)
   - OpenPhone message receiving
   - Slack notifications
   - External integrations

## The Smart Solution: Role-Based Token Strategy

### 1. Different Token Lifetimes by Role AND Operation Type

```typescript
// Enhanced token generation with context awareness
export const generateToken = (
  payload: JWTPayload,
  rememberMe: boolean = false,
  context?: {
    deviceType?: 'mobile' | 'desktop' | 'kiosk',
    operationType?: 'standard' | 'financial' | 'security'
  }
): string => {

  let expiresIn: string;

  // Special handling for security-sensitive operations
  if (context?.operationType === 'financial' || context?.operationType === 'security') {
    // Always short-lived for sensitive operations
    expiresIn = '15m';
    payload.scope = context.operationType; // Limit token scope
  }
  // PWA mode for standard operations
  else if (rememberMe) {
    switch (payload.role) {
      case 'customer':
        // Customers get long tokens - they don't access facility controls
        expiresIn = '90d';
        break;
      case 'operator':
        // Operators get medium tokens - balance security with usability
        expiresIn = '7d';
        break;
      case 'admin':
        // Admins get shorter tokens - highest privilege
        expiresIn = '24h';
        break;
      case 'contractor':
        // Contractors get session-based tokens
        expiresIn = '8h';
        break;
      case 'kiosk':
        // Kiosk mode - device-bound
        expiresIn = '30d';
        break;
      default:
        expiresIn = '4h';
    }
  } else {
    // Non-remember-me: Current conservative approach
    expiresIn = '4h';
  }

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn,
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
};
```

### 2. Implement Stepped Authentication

For sensitive operations, require fresh authentication:

```typescript
// Middleware for sensitive operations
export const requireFreshAuth = (maxAge: number = 900000) => { // 15 minutes default
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.user?.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = verifyToken(token);
    const tokenAge = Date.now() / 1000 - decoded.iat;

    if (tokenAge > maxAge / 1000) {
      return res.status(403).json({
        error: 'Fresh authentication required',
        code: 'STALE_AUTH',
        requiresReauth: true
      });
    }

    next();
  };
};

// Apply to sensitive routes
router.post('/api/admin/users/:id/delete', authenticate, requireFreshAuth(), deleteUser);
router.post('/api/unifi/doors/unlock', authenticate, requireFreshAuth(300000), unlockDoor); // 5 min
router.post('/api/challenges/wager', authenticate, requireFreshAuth(), createWager);
router.post('/api/admin/cc-adjustments', authenticate, requireFreshAuth(), adjustClubCoins);
```

### 3. Separate Token Types

```typescript
// Different token types for different purposes
enum TokenType {
  ACCESS = 'access',        // Standard operations
  REFRESH = 'refresh',      // Token refresh only
  SENSITIVE = 'sensitive',  // Financial/security operations
  READONLY = 'readonly'     // View-only access
}

// In frontend, handle token types
const performSensitiveOperation = async (operation: () => Promise<any>) => {
  try {
    return await operation();
  } catch (error) {
    if (error.response?.data?.code === 'STALE_AUTH') {
      // Prompt for password/PIN/biometric
      const freshToken = await promptForReauth();
      // Retry with fresh token
      return await operation();
    }
    throw error;
  }
};
```

### 4. Device Binding for Extended Sessions

```typescript
// Add device fingerprinting for long-lived tokens
interface DeviceFingerprint {
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
}

// Store device fingerprint with token
const storeSessionWithDevice = async (
  userId: string,
  token: string,
  device: DeviceFingerprint
) => {
  const deviceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(device))
    .digest('hex');

  await db.query(`
    INSERT INTO user_sessions (user_id, token_hash, device_hash, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '90 days')
  `, [userId, hashToken(token), deviceHash]);
};

// Validate device on each request for long tokens
const validateDevice = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user && isLongLivedToken(req.user.token)) {
    const currentDevice = extractDeviceFingerprint(req);
    const storedDevice = await getStoredDevice(req.user.id, req.user.token);

    if (!devicesMatch(currentDevice, storedDevice)) {
      return res.status(401).json({
        error: 'Device mismatch',
        code: 'DEVICE_CHANGED'
      });
    }
  }
  next();
};
```

### 5. Progressive Security Degradation

```typescript
// Smart token refresh based on activity and risk
class AdaptiveTokenManager {
  refreshToken(user: User, lastActivity: Date, currentToken: string) {
    const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

    // Active users get longer tokens
    if (hoursSinceActivity < 1) {
      // Very active - extend generously
      if (user.role === 'operator') {
        return this.generateToken(user, '14d');
      } else if (user.role === 'customer') {
        return this.generateToken(user, '90d');
      }
    } else if (hoursSinceActivity < 24) {
      // Recently active - standard extension
      if (user.role === 'operator') {
        return this.generateToken(user, '7d');
      } else if (user.role === 'customer') {
        return this.generateToken(user, '30d');
      }
    } else {
      // Inactive - shorter tokens
      return this.generateToken(user, '24h');
    }
  }
}
```

## Implementation Plan - Safe Rollout

### Phase 1: Safe Quick Wins (No Risk)
```typescript
// 1. Extend ONLY customer tokens first (lower risk)
if (payload.role === 'customer' && rememberMe) {
  expiresIn = '90d'; // They don't have facility access
}

// 2. Improve token refresh threshold (current logic, just earlier)
const refreshThreshold = totalTokenLife * 0.3; // Refresh at 30% remaining

// 3. Add token refresh endpoint (doesn't change existing tokens)
router.post('/api/auth/refresh', refreshTokenHandler);
```

### Phase 2: Operator Improvements (With Safeguards)
```typescript
// 1. Moderate extension for operators with activity tracking
if (payload.role === 'operator' && rememberMe) {
  expiresIn = '7d'; // Not too long, but better than 4h
}

// 2. Require fresh auth for sensitive operations
router.use('/api/unifi/*', requireFreshAuth(300000)); // 5 minutes
router.use('/api/admin/*', requireFreshAuth(900000)); // 15 minutes

// 3. Add audit logging for extended sessions
logExtendedSession(user, token, device);
```

### Phase 3: Full PWA Mode (With Complete Safety)
```typescript
// 1. Implement device binding
// 2. Add stepped authentication UI
// 3. Deploy activity-based token management
// 4. Enable biometric authentication for sensitive ops
```

## The Balanced Approach

### For Operators (Your Primary Users)
- **Default**: 7-day tokens with "Remember Me"
- **Refresh**: Automatic at 50% lifetime (3.5 days)
- **Security**: Fresh auth for door unlocks, admin actions
- **Result**: Login once per week maximum

### For Customers
- **Default**: 90-day tokens with "Remember Me"
- **Refresh**: Automatic at 30% lifetime
- **Security**: Fresh auth for financial operations
- **Result**: Rarely see login screen

### For Admins
- **Default**: 24-hour tokens even with "Remember Me"
- **Refresh**: Automatic at 50% lifetime
- **Security**: Fresh auth for all modifications
- **Result**: Daily login for security

### For Contractors
- **Default**: 8-hour work session
- **Refresh**: Not automatic
- **Security**: Location-bound permissions
- **Result**: Login at start of shift

## Testing Checklist Before Deployment

- [ ] Test customer challenges/wagering with extended tokens
- [ ] Test operator door unlock with extended tokens
- [ ] Test admin user management with extended tokens
- [ ] Test contractor checklist access
- [ ] Test webhook integrations (OpenPhone, Slack)
- [ ] Test token refresh during active session
- [ ] Test device change detection
- [ ] Test fresh auth prompts for sensitive operations
- [ ] Test offline PWA functionality
- [ ] Test session persistence after app closure

## Monitoring After Deployment

```typescript
// Add metrics tracking
const tokenMetrics = {
  track401Errors: (user, endpoint) => { /* log to analytics */ },
  trackTokenRefresh: (user, oldToken, newToken) => { /* log */ },
  trackSensitiveOperation: (user, operation, required_reauth) => { /* log */ },
  trackSessionDuration: (user, duration) => { /* log */ }
};
```

## Conclusion

You were absolutely right to be cautious. The solution needs to:

1. **Different token strategies for different roles** - Not one-size-fits-all
2. **Stepped authentication for sensitive operations** - Long tokens for convenience, fresh auth for security
3. **No impact on webhooks/integrations** - They use API keys, not user tokens
4. **Progressive rollout** - Start with customers (low risk), then operators (with safeguards)
5. **Device binding** - Prevent token theft/sharing
6. **Audit everything** - Know who accessed what and when

This approach gives you the PWA experience you want while maintaining security for facility management operations.