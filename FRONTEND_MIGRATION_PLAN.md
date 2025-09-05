# Frontend Migration Plan - ClubOS v2 API

## ⚠️ Critical Warning
Frontend migration is often **the hardest part** of API refactoring because:
- API calls are scattered throughout components
- State management depends on response formats
- Error handling patterns may differ
- User experience must remain seamless
- Rollback is complex once deployed

## Current Status

### Auth Module
- **Backend**: ✅ Complete at `/api/v2/auth`
- **Frontend**: ❌ Still using `/api/auth`
- **Risk**: HIGH - Auth affects entire app

## Discovery Checklist

### 1. Find All Auth API Calls
```bash
# Run from frontend directory
grep -r "/api/auth" --include="*.tsx" --include="*.ts" --include="*.js" .
grep -r "fetch.*auth" --include="*.tsx" --include="*.ts" .
grep -r "axios.*auth" --include="*.tsx" --include="*.ts" .
```

### 2. Common Locations to Check
- [ ] `/components/auth/LoginForm.tsx`
- [ ] `/components/auth/SignupForm.tsx`
- [ ] `/components/auth/ForgotPassword.tsx`
- [ ] `/lib/auth.ts` or `/utils/auth.ts`
- [ ] `/contexts/AuthContext.tsx`
- [ ] `/hooks/useAuth.ts`
- [ ] `/middleware.ts` (Next.js middleware)
- [ ] `/pages/_app.tsx` or `/app/layout.tsx`

## Migration Strategy

### Phase 1: Create Abstraction Layer
```typescript
// /frontend/services/api/config.ts
export const API_CONFIG = {
  // Toggle this to switch versions
  USE_V2: process.env.NEXT_PUBLIC_USE_V2_API === 'true',
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005',
};

// /frontend/services/api/auth.service.ts
import { API_CONFIG } from './config';

const AUTH_BASE = API_CONFIG.USE_V2 ? '/api/v2/auth' : '/api/auth';

export const authService = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${AUTH_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },
  
  signup: async (data: SignupData) => {
    // Similar pattern
  },
  
  logout: async (token: string) => {
    // Similar pattern
  },
};
```

### Phase 2: Response Format Mapping
```typescript
// Handle differences between v1 and v2 responses
export const normalizeAuthResponse = (response: any, version: 'v1' | 'v2') => {
  if (version === 'v2') {
    // v2 format: { success, message, data: { user, token, refreshToken } }
    return {
      user: response.data?.user,
      token: response.data?.token,
      refreshToken: response.data?.refreshToken,
      error: !response.success ? response.message : null,
    };
  } else {
    // v1 format: might be different
    return {
      user: response.user,
      token: response.token,
      error: response.error,
    };
  }
};
```

### Phase 3: Update Components Gradually
1. Start with less critical flows (password reset)
2. Move to signup
3. Finally update login (most critical)

### Phase 4: Testing Plan
- [ ] Manual testing of all auth flows
- [ ] E2E tests for critical paths
- [ ] Monitor error rates in production
- [ ] A/B test with feature flags
- [ ] Load testing on new endpoints

## Rollback Strategy

### Quick Rollback via Environment Variable
```bash
# In Vercel/deployment platform
NEXT_PUBLIC_USE_V2_API=false  # Instant rollback
```

### Monitoring Checklist
- [ ] Set up Sentry alerts for auth errors
- [ ] Monitor response times
- [ ] Track successful login rates
- [ ] Watch for increased support tickets

## Module-by-Module Tracking

| Module | Frontend Files | API Calls | Abstracted | Updated | Tested | Deployed |
|--------|---------------|-----------|-----------|---------|--------|----------|
| **Auth** | | | | | | |
| LoginForm | `/components/auth/LoginForm.tsx` | 2 | ❌ | ❌ | ❌ | ❌ |
| SignupForm | `/components/auth/SignupForm.tsx` | 1 | ❌ | ❌ | ❌ | ❌ |
| AuthContext | `/contexts/AuthContext.tsx` | 4 | ❌ | ❌ | ❌ | ❌ |
| Middleware | `/middleware.ts` | 1 | ❌ | ❌ | ❌ | ❌ |
| useAuth | `/hooks/useAuth.ts` | 3 | ❌ | ❌ | ❌ | ❌ |
| ProfilePage | `/pages/profile.tsx` | 2 | ❌ | ❌ | ❌ | ❌ |
| **Total** | **6 files** | **13 calls** | **0%** | **0%** | **0%** | **0%** |

## Risk Assessment

### High Risk Areas
1. **Token Management**: JWT format/claims might differ
2. **Error Handling**: Different error response formats
3. **State Management**: Redux/Context updates needed
4. **Protected Routes**: Middleware compatibility
5. **Session Refresh**: Token refresh flow changes

### Mitigation Strategies
1. Run both APIs in parallel for 2 weeks
2. Use feature flags for gradual rollout
3. Implement comprehensive logging
4. Have rollback plan ready
5. Communicate with users about potential issues

## Success Criteria
- [ ] All auth flows working with v2 API
- [ ] No increase in error rates
- [ ] Response times equal or better
- [ ] Zero customer complaints
- [ ] Old endpoints can be safely removed

## Timeline
- **Week 3**: Create abstraction layer, begin discovery
- **Week 4**: Update components, test thoroughly
- **Week 5**: Deploy to staging, monitor closely
- **Week 6**: Production deployment with feature flags
- **Week 8**: Remove old endpoints (if stable)

---

*Last Updated: September 5, 2025*
*Status: Planning Phase - Frontend migration not yet started*