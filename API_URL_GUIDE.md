# API URL Configuration Guide

## The Problem
We keep having issues with API URLs because of confusion about when to include `/api` prefix.

## The Solution

### Environment Variable
```bash
# .env.production and .env.local
NEXT_PUBLIC_API_URL=https://clubosv2-production.up.railway.app
# NO /api suffix - just the base URL
```

### Backend Routes
The backend serves two types of endpoints:
1. **API endpoints**: `/api/*` (most endpoints)
2. **System endpoints**: `/system-settings/*`, `/health`, etc (no /api prefix)

### Frontend Usage

#### For API endpoints (99% of cases):
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Making API calls
axios.get(`${API_URL}/api/users`)          // ✅ Correct
axios.post(`${API_URL}/api/achievements`)  // ✅ Correct
```

#### For system endpoints:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// System calls (no /api prefix)
axios.get(`${API_URL}/system-settings/customer_auto_approval`)  // ✅ Correct
axios.get(`${API_URL}/health`)                                   // ✅ Correct
```

## Common Mistakes to Avoid

❌ **DON'T** set NEXT_PUBLIC_API_URL with `/api` suffix:
```bash
NEXT_PUBLIC_API_URL=https://clubosv2-production.up.railway.app/api  # ❌ Wrong
```

❌ **DON'T** double up the `/api`:
```typescript
// If API_URL already has /api
axios.get(`${API_URL}/api/users`)  // Results in /api/api/users ❌
```

## Quick Checklist
1. Environment variable = base URL only (no /api)
2. Add `/api` prefix in the code for API endpoints
3. No `/api` prefix for system endpoints
4. Test locally before deploying

## Testing
```bash
# Check your API URL
echo $NEXT_PUBLIC_API_URL
# Should output: https://clubosv2-production.up.railway.app (no /api)

# Test an API endpoint
curl https://clubosv2-production.up.railway.app/api/health

# Test a system endpoint  
curl https://clubosv2-production.up.railway.app/system-settings/customer_auto_approval
```