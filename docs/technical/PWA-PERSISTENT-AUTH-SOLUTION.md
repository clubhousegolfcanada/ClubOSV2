# PWA-Style Persistent Authentication for ClubOS

## Goal: Login Once, Use Forever (Like Native Apps)

### The Vision
- Open ClubOS → Instantly ready to use (no login screen)
- Close and reopen days/weeks later → Still logged in
- Only see login screen on explicit logout or security events
- True app-like experience

## Immediate Quick Fix (Deploy Today)

### 1. Extend Token Lifetimes Dramatically
**File**: `/ClubOSV1-backend/src/middleware/auth.ts`

```typescript
// Line 34-60 - Update token expiration logic
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>, rememberMe: boolean = false): string => {
  let expiresIn: string;

  if (rememberMe) {
    // PWA MODE: 1 year for true app experience
    expiresIn = '365d';
  } else {
    // Still generous for non-remember-me
    switch (payload.role) {
      case 'customer':
        expiresIn = '30d';  // Was 8h
        break;
      case 'operator':
      case 'admin':
        expiresIn = '90d';  // Was 4h - operators use this daily
        break;
      case 'kiosk':
        expiresIn = '7d';   // Was 12h - kiosks stay logged in
        break;
      case 'contractor':
        expiresIn = '30d';  // Was 8h
        break;
      default:
        expiresIn = '30d';
    }
  }

  return jwt.sign(payload, config.JWT_SECRET as string, {
    expiresIn: expiresIn,
    issuer: 'clubosv1',
    audience: 'clubosv1-users'
  });
};
```

### 2. More Aggressive Token Refresh
**File**: `/ClubOSV1-backend/src/middleware/auth.ts`

```typescript
// Line 138-157 - Refresh tokens much earlier
const now = Date.now() / 1000;
const timeUntilExpiry = (decoded.exp || 0) - now;
const totalTokenLife = (decoded.exp || 0) - (decoded.iat || 0);

// Refresh when 50% of lifetime remains (not just 1 hour)
const refreshThreshold = totalTokenLife * 0.5;

if (timeUntilExpiry < refreshThreshold) {
  // Token has less than 50% life remaining, issue new one
  const wasRememberMe = totalTokenLife > 2592000; // > 30 days means remember me

  const newToken = generateToken({
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    sessionId: decoded.sessionId,
    name: decoded.name,
    phone: decoded.phone
  }, wasRememberMe);

  res.setHeader('X-New-Token', newToken);

  logger.info('Token auto-refreshed for PWA persistence', {
    userId: decoded.userId,
    remainingLife: `${Math.round(timeUntilExpiry / 86400)} days`,
    newTokenLife: wasRememberMe ? '365d' : '30-90d'
  });
}
```

### 3. Frontend: Handle New Tokens Properly
**File**: `/ClubOSV1-frontend/src/api/http.ts`

```typescript
// Add to response interceptor (line 92)
client.interceptors.response.use(
  (response) => {
    // Always check for refreshed tokens
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      tokenManager.setToken(newToken);
      logger.debug('Received and stored refreshed token');

      // Update the auth state to prevent any staleness
      const { user } = useAuthState.getState();
      if (user) {
        useAuthState.setState({ token: newToken });
      }
    }
    return response;
  },
  (error: ApiError) => {
    // Existing error handling...
  }
);
```

### 4. Default "Remember Me" to Checked
**File**: `/ClubOSV1-frontend/src/pages/login.tsx`

```typescript
// Line 25 - Default to true for PWA experience
const [rememberMe, setRememberMe] = useState(true); // Was false
```

Update the label too:
```typescript
// Line 327-329
<label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--text-secondary)]">
  Keep me signed in (recommended)
</label>
```

## Enhanced PWA Features

### 1. Add Biometric/PIN Authentication (Future)
For even better PWA experience, add biometric unlock:

```typescript
// In frontend - use Web Authentication API
if ('credentials' in navigator && 'PublicKeyCredential' in window) {
  // Device supports biometric/PIN
  // Store encrypted token with biometric protection
}
```

### 2. Service Worker Token Management
**File**: `/ClubOSV1-frontend/public/service-worker.js`

```javascript
// Intercept API calls and add token from secure storage
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      (async () => {
        // Get token from IndexedDB (survives app closure)
        const db = await openDB();
        const token = await db.get('auth', 'token');

        if (token) {
          // Clone request with auth header
          const modifiedRequest = new Request(event.request, {
            headers: new Headers({
              ...event.request.headers,
              'Authorization': `Bearer ${token}`
            })
          });

          const response = await fetch(modifiedRequest);

          // Check for new token in response
          const newToken = response.headers.get('X-New-Token');
          if (newToken) {
            await db.put('auth', newToken, 'token');
          }

          return response;
        }

        return fetch(event.request);
      })()
    );
  }
});
```

### 3. Offline-First Architecture
Store critical data locally for instant app launch:

```typescript
// Enhanced local storage strategy
class PersistentStorage {
  private db: IDBDatabase;

  async initialize() {
    // IndexedDB for complex data
    this.db = await openDB('clubos', 1, {
      upgrade(db) {
        db.createObjectStore('auth');
        db.createObjectStore('userData');
        db.createObjectStore('recentMessages');
        db.createObjectStore('recentTickets');
      }
    });
  }

  async cacheUserSession(user: User, token: string) {
    // Store in multiple places for redundancy
    await this.db.put('auth', token, 'token');
    await this.db.put('userData', user, 'currentUser');

    // Also in localStorage as backup
    localStorage.setItem('clubos_token', token);
    localStorage.setItem('clubos_user', JSON.stringify(user));

    // And in sessionStorage for tab persistence
    sessionStorage.setItem('clubos_active', 'true');
  }

  async restoreSession(): Promise<{ user: User, token: string } | null> {
    try {
      // Try IndexedDB first (most reliable)
      const token = await this.db.get('auth', 'token');
      const user = await this.db.get('userData', 'currentUser');

      if (token && user) {
        return { user, token };
      }

      // Fallback to localStorage
      const lsToken = localStorage.getItem('clubos_token');
      const lsUser = localStorage.getItem('clubos_user');

      if (lsToken && lsUser) {
        return {
          user: JSON.parse(lsUser),
          token: lsToken
        };
      }
    } catch (error) {
      logger.error('Session restore failed:', error);
    }

    return null;
  }
}
```

### 4. App.tsx - Skip Login Screen
**File**: `/ClubOSV1-frontend/src/pages/_app.tsx`

```typescript
// Auto-restore session on app launch
useEffect(() => {
  const initializeAuth = async () => {
    const storage = new PersistentStorage();
    await storage.initialize();

    const session = await storage.restoreSession();
    if (session && !tokenManager.isTokenExpired(session.token)) {
      // Valid session found - skip login entirely
      login(session.user, session.token);

      // Start token monitoring for auto-refresh
      tokenManager.startTokenMonitoring();

      // Pre-fetch common data in background
      prefetchDashboardData();
    }
  };

  initializeAuth();
}, []);
```

## Security Considerations (Balanced with UX)

### 1. Secure Token Storage
- Use encryption for stored tokens
- Device-bound tokens (optional fingerprinting)
- Clear tokens only on explicit logout

### 2. Monitoring & Alerts
- Track unusual login patterns
- Alert on new device logins
- But DON'T force re-authentication unless necessary

### 3. Graceful Degradation
- If token is invalid, try refresh
- If refresh fails, try stored credentials
- Only show login as last resort

## Implementation Priority

### Phase 1: Immediate (Today)
1. ✅ Extend token lifetimes (backend)
2. ✅ Change refresh threshold to 50% (backend)
3. ✅ Default "Remember Me" to checked (frontend)
4. ✅ Handle X-New-Token header properly (frontend)

### Phase 2: This Week
1. Add IndexedDB token storage
2. Implement session restoration on app launch
3. Add service worker token management
4. Test PWA installation and persistence

### Phase 3: Next Sprint
1. Add biometric authentication option
2. Implement offline data caching
3. Add background sync for offline actions
4. Optimize app launch speed

## Success Metrics

### Current State
- Users login multiple times per day
- 401 errors cause friction
- App doesn't feel native

### Target State (After Implementation)
- **Login frequency**: < 1 time per month
- **App launch time**: < 500ms to interactive
- **Session persistence**: 99.9% success rate
- **User satisfaction**: "Feels like a real app"

## Testing Checklist

- [ ] Login with "Remember Me" checked
- [ ] Close PWA completely
- [ ] Reopen after 1 day - should still be logged in
- [ ] Reopen after 1 week - should still be logged in
- [ ] Reopen after 1 month - should still be logged in
- [ ] Token should auto-refresh in background
- [ ] No 401 errors during normal usage
- [ ] Offline mode shows cached data
- [ ] Only see login screen on explicit logout

## Quick Implementation Script

```bash
# 1. Update backend auth middleware
vim ClubOSV1-backend/src/middleware/auth.ts
# Make the changes above

# 2. Update frontend login page
vim ClubOSV1-frontend/src/pages/login.tsx
# Default rememberMe to true

# 3. Test locally
cd ClubOSV1-backend && npm run dev
cd ClubOSV1-frontend && npm run dev

# 4. Deploy
git add -A
git commit -m "feat: PWA-style persistent authentication - login once, use forever"
git push

# Users will experience:
# - Automatic 1-year sessions with "Remember Me"
# - Tokens refresh at 50% lifetime (6 months for 1-year tokens)
# - App stays logged in between uses
# - True PWA experience
```

## The Result

ClubOS will behave like WhatsApp Web, Slack, Discord, or any quality PWA:
- **Open app → Instantly ready**
- **No login fatigue**
- **Feels native**
- **Always accessible**
- **Just works**

This is how modern PWAs should behave - prioritizing user experience while maintaining reasonable security.