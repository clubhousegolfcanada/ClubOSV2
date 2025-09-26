# Operator-First PWA Authentication Plan

## Primary Goal: Make ClubOS Easy for Daily Operators
**7-day tokens for operators starting today - they're your main users**

## Immediate Implementation (Deploy Today)

### 1. Update Token Generation - Operator-Focused
**File**: `/ClubOSV1-backend/src/middleware/auth.ts`

```typescript
// Line 34-60 - Operator-friendly token lifetimes
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string => {
  let expiresIn: string;

  if (rememberMe) {
    switch (payload.role) {
      case 'operator':
        expiresIn = '30d';  // Operators get month-long tokens with Remember Me
        break;
      case 'admin':
        expiresIn = '30d';  // Admins are also operators, same convenience
        break;
      case 'customer':
        expiresIn = '90d';  // Customers can have even longer
        break;
      case 'contractor':
        expiresIn = '7d';   // Weekly for contractors
        break;
      case 'kiosk':
        expiresIn = '30d';  // Kiosks stay logged in
        break;
      default:
        expiresIn = '7d';
    }
  } else {
    // Without "Remember Me" - still generous for operators
    switch (payload.role) {
      case 'operator':
      case 'admin':
        expiresIn = '7d';   // Full week even without Remember Me
        break;
      case 'customer':
        expiresIn = '24h';  // Customers get a day
        break;
      case 'contractor':
        expiresIn = '8h';   // Shift-based
        break;
      case 'kiosk':
        expiresIn = '7d';   // Kiosks get a week
        break;
      default:
        expiresIn = '24h';
    }
  }

  return jwt.sign(payload, config.JWT_SECRET as string, {
    expiresIn: expiresIn,
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
};
```

### 2. Aggressive Token Refresh for Operators
**File**: `/ClubOSV1-backend/src/middleware/auth.ts`

```typescript
// Line 138-157 - Refresh operator tokens at 70% lifetime
// This means a 7-day token refreshes after 2 days
// A 30-day token refreshes after 9 days

const now = Date.now() / 1000;
const timeUntilExpiry = (decoded.exp || 0) - now;
const totalTokenLife = (decoded.exp || 0) - (decoded.iat || 0);

// Operators/Admins get super aggressive refresh
let refreshThreshold: number;
if (decoded.role === 'operator' || decoded.role === 'admin') {
  refreshThreshold = totalTokenLife * 0.7;  // Refresh at 70% lifetime consumed
} else {
  refreshThreshold = totalTokenLife * 0.5;  // Others at 50%
}

if ((totalTokenLife - timeUntilExpiry) > refreshThreshold) {
  // User has consumed more than threshold of token lifetime
  const wasRememberMe = totalTokenLife > 604800; // > 7 days means remember me was checked

  const newToken = generateToken({
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    sessionId: decoded.sessionId,
    name: decoded.name,
    phone: decoded.phone
  }, wasRememberMe);

  res.setHeader('X-New-Token', newToken);

  logger.info('Token auto-refreshed for operator convenience', {
    userId: decoded.userId,
    role: decoded.role,
    oldTokenRemaining: `${Math.round(timeUntilExpiry / 86400)} days`,
    newTokenLife: wasRememberMe ? '30d' : '7d'
  });
}
```

### 3. Frontend Token Manager - Operator-Optimized
**File**: `/ClubOSV1-frontend/src/utils/tokenManager.ts`

```typescript
// Enhanced monitoring for operators - check more frequently
private getCheckInterval(token: string): number {
  const timeUntilExpiry = this.getTimeUntilExpiration(token);
  const role = this.getUserRole(token);

  // Operators get more frequent checks to ensure smooth experience
  if (role === 'operator' || role === 'admin') {
    if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) { // > 7 days
      return 2 * 60 * 60 * 1000; // Check every 2 hours
    } else if (timeUntilExpiry > 24 * 60 * 60 * 1000) { // > 1 day
      return 30 * 60 * 1000; // Check every 30 minutes
    } else {
      return 5 * 60 * 1000; // Check every 5 minutes when close
    }
  }

  // Customers can have less frequent checks
  if (timeUntilExpiry > 30 * 24 * 60 * 60 * 1000) { // > 30 days
    return 12 * 60 * 60 * 1000; // Check every 12 hours
  } else if (timeUntilExpiry > 7 * 24 * 60 * 60 * 1000) { // > 7 days
    return 4 * 60 * 60 * 1000; // Check every 4 hours
  } else {
    return 60 * 60 * 1000; // Check every hour
  }
}

// Proactive refresh for operators
startTokenMonitoring(): void {
  if (this.checkInterval) {
    clearInterval(this.checkInterval);
  }

  const checkAndRefresh = async () => {
    const token = this.getToken();
    if (!token) return;

    const timeUntilExpiry = this.getTimeUntilExpiration(token);
    const role = this.getUserRole(token);
    const totalLife = this.getTokenTotalLife(token);

    // Operators get refreshed early and often
    let shouldRefresh = false;

    if (role === 'operator' || role === 'admin') {
      // Refresh when 70% consumed OR less than 2 days remaining
      const consumed = (totalLife - timeUntilExpiry) / totalLife;
      shouldRefresh = consumed > 0.7 || timeUntilExpiry < 2 * 24 * 60 * 60 * 1000;
    } else {
      // Others refresh at 50% or 1 day
      const consumed = (totalLife - timeUntilExpiry) / totalLife;
      shouldRefresh = consumed > 0.5 || timeUntilExpiry < 24 * 60 * 60 * 1000;
    }

    if (shouldRefresh) {
      logger.info('Proactively refreshing token', {
        role,
        timeRemaining: Math.round(timeUntilExpiry / (60 * 60 * 1000)) + ' hours'
      });

      // Just make any API call - the backend will send new token in header
      try {
        await http.get('/system/health');
      } catch (error) {
        logger.error('Token refresh check failed:', error);
      }
    }

    // Adjust check interval dynamically
    const newInterval = this.getCheckInterval(token);
    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval;
      this.startTokenMonitoring();
    }
  };

  // Initial check
  checkAndRefresh();

  // Set up recurring check
  this.currentInterval = this.getCheckInterval(this.getToken() || '');
  this.checkInterval = setInterval(checkAndRefresh, this.currentInterval);
}
```

### 4. Default "Remember Me" for Operators
**File**: `/ClubOSV1-frontend/src/pages/login.tsx`

```typescript
// Line 25 - Smart defaults based on login mode
const [rememberMe, setRememberMe] = useState(loginMode === 'operator'); // True for operators

// Line 14 - Detect if user is likely an operator from their email
useEffect(() => {
  // If email contains clubhouse domain or common operator emails
  if (email.includes('@clubhouse') || email.includes('operator')) {
    setRememberMe(true);
    setLoginMode('operator');
  }
}, [email]);

// Line 327-329 - Update label for operators
<label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--text-secondary)]">
  {loginMode === 'operator'
    ? 'Keep me signed in for 30 days'
    : 'Remember me'}
</label>
```

### 5. Add Security for Sensitive Operations Only
**File**: `/ClubOSV1-backend/src/middleware/auth.ts`

```typescript
// Add this new middleware for sensitive operations only
export const requireRecentAuth = (maxAgeMinutes: number = 15) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Only apply to truly sensitive operations
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = verifyToken(token);
      const tokenAgeMinutes = (Date.now() / 1000 - decoded.iat) / 60;

      if (tokenAgeMinutes > maxAgeMinutes) {
        // Don't force full re-login, just need a password confirmation
        return res.status(403).json({
          error: 'Please confirm your password',
          code: 'CONFIRM_PASSWORD',
          message: 'This action requires password confirmation'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};
```

Apply ONLY to truly sensitive routes:
```typescript
// Only these need fresh auth - everything else uses long tokens
router.delete('/api/users/:id', authenticate, requireRecentAuth(5), deleteUser);
router.post('/api/admin/reset-database', authenticate, requireRecentAuth(1), resetDatabase);
router.post('/api/financial/manual-adjustment', authenticate, requireRecentAuth(10), manualAdjust);
```

## Operator Experience After Implementation

### Day 1 (Login Day)
- Operator logs in with "Remember Me" checked (default)
- Gets 30-day token
- ClubOS saves to localStorage + IndexedDB
- PWA installed on phone/desktop

### Day 2-6
- Opens ClubOS → Instantly ready
- Token silently refreshes in background (at day 2-3)
- New 30-day token issued automatically
- Never sees login screen

### Day 7-30
- Continues opening and using instantly
- Token keeps refreshing every few days
- Smooth, app-like experience

### Special Cases
- Unlocking doors → Works with long token (no extra auth needed)
- Viewing tickets/messages → Instant
- Admin deleting users → Quick password confirm (not full login)

## Rollout Plan

### Today (Immediate)
1. Deploy backend changes (7-day minimum, 30-day with Remember Me)
2. Deploy frontend (default Remember Me for operators)
3. Test with one operator account

### Tomorrow
1. Roll out to all operators
2. Monitor for any 401 errors
3. Adjust refresh thresholds if needed

### Next Week
1. Extend to admin accounts
2. Add password confirmation UI for sensitive operations
3. Implement IndexedDB persistence

## Monitoring & Success Metrics

```typescript
// Add to backend logging
logger.info('Token metrics', {
  role: decoded.role,
  tokenLifeDays: totalTokenLife / 86400,
  daysUntilExpiry: timeUntilExpiry / 86400,
  willRefresh: shouldRefresh,
  endpoint: req.path
});
```

### Success Criteria
- **Operators login less than once per week**
- **401 errors drop by 95%**
- **No security incidents from extended tokens**
- **Operator satisfaction: "It just works"**

## Why This Works for ClubOS

1. **Operators are trusted employees** - Not random internet users
2. **Most operations are non-financial** - Reading messages, managing tickets
3. **Physical security exists** - They're in the facility
4. **Convenience drives adoption** - If it's annoying, they won't use it
5. **PWA needs persistence** - Can't feel like an app with constant logins

## Quick Deploy Commands

```bash
# 1. Make the backend changes
cd ClubOSV1-backend
# Edit src/middleware/auth.ts with changes above

# 2. Make the frontend changes
cd ClubOSV1-frontend
# Edit src/utils/tokenManager.ts and src/pages/login.tsx

# 3. Test locally
npm run dev # both frontend and backend

# 4. Deploy to production
git add -A
git commit -m "feat: operator-friendly 7-30 day tokens for PWA experience"
git push

# Operators will immediately experience:
# - 7 day tokens minimum
# - 30 day tokens with "Remember Me"
# - Automatic refresh every 2-3 days
# - No more constant login screens
```

## The Bottom Line

**Operators deserve a smooth experience.** They use ClubOS all day, every day. Making them login constantly is friction that hurts productivity. With 7-30 day tokens that auto-refresh, ClubOS becomes a true PWA that's always ready to use.

Security matters, but it shouldn't punish your primary users. This plan gives operators the convenience they need while keeping truly sensitive operations (like database resets) protected with password confirmation.