# HTTP Client Migration Plan - ClubOS V1

## Overview
Complete migration from scattered axios/API_URL usage to centralized http client with unified auth and standardized error handling.

## Current Status
- ✅ Step 1: Locked http client with final implementation
- ✅ Step 2: Created ESLint rules to ban regressions
- ✅ Step 3: Unified token access with tokenManager (50 files updated)
- ⏳ Step 4: Remove manual Authorization headers
- ⏳ Step 5: Kill remaining axios and API_URL references
- ⏳ Step 6: Standard error handling utilities
- ⏳ Step 7: CSRF and auth flow verification
- ⏳ Step 8: Delete duplicate components
- ⏳ Step 9: Add TypeScript types for API responses
- ⏳ Step 10: Setup CI scripts and final verification

## Completed Work

### 1. HTTP Client Implementation ✅
- Created centralized `src/api/http.ts` with:
  - Automatic URL resolution (prevents double /api)
  - Token injection via tokenManager
  - 401 handling with redirect to login
  - Export of get, post, put, patch, del helpers
  - ApiError type definition

### 2. ESLint Rules ✅
- Created `.eslintrc.js` with rules to ban:
  - Direct axios imports
  - API_URL variable usage
  - process.env.NEXT_PUBLIC_API_URL direct access
  - localStorage token operations

### 3. Token Manager Integration ✅
- Updated 50 files to use tokenManager instead of localStorage
- Added getToken(), setToken(), clearToken() methods
- Maintained SSR safety with typeof window checks

## Remaining Tasks

### 4. Remove Manual Authorization Headers
**Files to check:**
- [ ] src/pages/customer/compete.tsx
- [ ] src/pages/customer/profile.tsx
- [ ] src/components/RequestForm.tsx
- [ ] src/components/customer/CustomerDashboard.tsx
- [ ] All other components with API calls

**Pattern to remove:**
```javascript
// OLD - Remove this
headers: { Authorization: `Bearer ${token}` }

// NEW - Just use http methods
http.post('endpoint', data)
```

### 5. Kill Remaining axios and API_URL
**Search and replace:**
```bash
# Find axios imports
rg "import.*axios" src/

# Find API_URL usage
rg "API_URL" src/

# Find getApiUrl usage
rg "getApiUrl" src/
```

**Replace patterns:**
- `axios.get/post/put/delete` → `http.get/post/put/del`
- `${API_URL}/endpoint` → `'endpoint'`
- Remove all axios imports
- Remove all API_URL declarations

### 6. Standard Error Handling

**Create `src/utils/error.ts`:**
```typescript
import { ApiError } from '@/api/http';

export function isApiError(error: unknown): error is ApiError {
  return !!(error && typeof error === 'object' && 'response' in error);
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.response?.data?.message || 'An error occurred';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
```

**Create `src/utils/notify.ts`:**
```typescript
import toast from 'react-hot-toast';
import { getErrorMessage } from './error';

export function notifyError(error: unknown) {
  toast.error(getErrorMessage(error));
}

export function notifySuccess(message: string) {
  toast.success(message);
}
```

### 7. CSRF and Auth Flows
- [ ] Verify csrf.ts endpoint configuration
- [ ] Ensure auth endpoints use `{ auth: false }` config
- [ ] Test 401 redirect behavior
- [ ] Verify no redirect loops

### 8. Delete Duplicate Components
**Components to remove:**
- [ ] src/components/dashboard/MessagesCardV3-fixed.tsx
- [ ] src/components/dashboard/MessagesCardV3-hover-fix.tsx
- [ ] src/components/dashboard/MessagesCardV3.backup.tsx
- [ ] Merge OperationsDashboardEnhanced into OperationsDashboard
- [ ] Update all imports to use MessagesCardV3

### 9. Add TypeScript Types

**Create `src/types/api.ts`:**
```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  token?: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

// Add more types as needed
```

### 10. CI Setup

**Update package.json scripts:**
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "build:ci": "npm run lint && npm run typecheck && next build"
  }
}
```

## Testing Checklist

### Critical User Flows to Test
- [ ] **Login Flow**
  - [ ] Operator login works
  - [ ] Customer login works
  - [ ] Token is stored correctly
  - [ ] Redirect after login works

- [ ] **API Calls**
  - [ ] GET requests work
  - [ ] POST requests work
  - [ ] File uploads work
  - [ ] Auth headers are included

- [ ] **Error Handling**
  - [ ] 401 redirects to login
  - [ ] Network errors show toast
  - [ ] Validation errors display correctly

- [ ] **Token Management**
  - [ ] Token persists across page refreshes
  - [ ] Logout clears token
  - [ ] Token expiry handled gracefully

## Build Verification Commands

```bash
# 1. Clean install
rm -rf node_modules package-lock.json
npm install

# 2. Run linter
npm run lint

# 3. Type check
npm run typecheck

# 4. Build
npm run build

# 5. Start production
npm start
```

## Common Issues and Fixes

### Issue: Double /api/api in URLs
**Fix:** Ensure paths don't start with '/api/'
```javascript
// ❌ Wrong
http.get('/api/users')

// ✅ Correct
http.get('users')
```

### Issue: Missing auth headers
**Fix:** Check tokenManager has token
```javascript
// Debug in console
console.log(tokenManager.getToken())
```

### Issue: CORS errors
**Fix:** Ensure withCredentials is set (already in http client)

### Issue: TypeScript errors with response types
**Fix:** Use proper typing
```typescript
const response = await http.get<ApiResponse<User[]>>('users');
const users = response.data.data;
```

## Files Modified Summary

### Core Infrastructure
- `/src/api/http.ts` - Centralized HTTP client
- `/src/utils/tokenManager.ts` - Token management
- `/src/utils/resolveApi.ts` - URL resolution
- `.eslintrc.js` - Linting rules

### Authentication Files (50+ files)
- All updated to use tokenManager
- Removed direct localStorage access
- Added proper imports

### Components to Update
- Request forms
- Dashboard components
- Customer pages
- Operations pages

## Deployment Notes

1. **Environment Variables**
   - Ensure `NEXT_PUBLIC_API_URL` is set correctly
   - No trailing slash in API URL

2. **Backend Compatibility**
   - Backend must accept Bearer tokens
   - CORS must be configured for credentials

3. **Cache Clearing**
   - Users may need to clear browser cache
   - Service worker may need version bump

## Final Checklist Before Deploy

- [ ] All builds pass locally
- [ ] No console errors in browser
- [ ] Login/logout works for both user types
- [ ] API calls work correctly
- [ ] No double /api/ in network tab
- [ ] ESLint passes
- [ ] TypeScript has no errors
- [ ] All tests pass
- [ ] Deployment pipeline succeeds

## Contact for Issues
If you encounter issues during migration:
1. Check this document first
2. Review error messages carefully
3. Check browser console and network tab
4. Verify environment variables