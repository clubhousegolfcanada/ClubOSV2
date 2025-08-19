# Production Issues Fix Guide

## Issues Identified

### 1. Rate Limiting (429 errors)
**Problem:** Production server still has aggressive rate limits causing 429 errors
**Solution:** Already fixed in `/src/middleware/rateLimiter.ts` - needs deployment

### 2. Double API Path
**Problem:** URLs like `/api/api/challenges/my-challenges` 
**Root Cause:** Frontend base URL misconfiguration
**Fix Required:** In frontend environment variables, change:
```
NEXT_PUBLIC_API_URL=https://clubosv2-production.up.railway.app/api
```
to:
```
NEXT_PUBLIC_API_URL=https://clubosv2-production.up.railway.app
```

### 3. AI Context Issue  
**Problem:** AI returning unrelated golf simulator support docs when asked about color codes
**Possible Causes:**
- Wrong knowledge base loaded
- Incorrect system prompt
- Context pollution from previous queries

## Immediate Actions

### Deploy Backend Fix
```bash
git add -A
git commit -m "fix: increase rate limits for production stability"
git push
```

### Frontend Fix (in ClubOSV1 repo)
1. Update `.env.production`:
```env
NEXT_PUBLIC_API_URL=https://clubosv2-production.up.railway.app
```

2. Redeploy frontend

### AI Context Fix
Check these files:
- Knowledge base documents being fed to AI
- System prompts for the AI assistant
- Context window management

## Verification Steps

After deployment:
1. Test login without rate limit errors
2. Verify API calls use single `/api/` prefix
3. Test AI responses are relevant to queries

## Rate Limit Values (Current Production Fix)

```typescript
// src/middleware/rateLimiter.ts
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 5000 : 500, // Increased from 1000
  // ...
});
```

## Monitoring

Watch for:
- 429 status codes in logs
- Double `/api/api/` patterns
- AI response relevance scores