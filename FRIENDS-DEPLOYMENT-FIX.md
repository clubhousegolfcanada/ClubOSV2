# Friends System Deployment Fix

## Issue
The friends page and related APIs are returning 404 errors due to incorrect API URL configuration in Vercel.

## Root Cause
The Vercel environment variable `NEXT_PUBLIC_API_URL` is incorrectly set to include `/api` at the end, causing URLs like:
- `https://clubosv2-production.up.railway.app/api/api/friends`
- `https://clubosv2-production.up.railway.app/api/api/customer-profile`

## Solution

### Fix in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select the ClubOS frontend project
3. Go to Settings → Environment Variables
4. Find `NEXT_PUBLIC_API_URL`
5. Change from: `https://clubosv2-production.up.railway.app/api`
6. Change to: `https://clubosv2-production.up.railway.app`
7. Click Save
8. Redeploy the application (will happen automatically)

### Why This Fixes It
- The frontend code already adds `/api` when constructing URLs
- Example: `${API_URL}/api/friends` 
- With the wrong env var: `https://clubosv2-production.up.railway.app/api/api/friends` ❌
- With the correct env var: `https://clubosv2-production.up.railway.app/api/friends` ✅

## Verification

After the fix and redeploy, verify:

1. **API endpoints work**:
   ```bash
   curl https://clubosv2-production.up.railway.app/api/friends
   # Should return: {"error":"Unauthorized","message":"No token provided"}
   ```

2. **Friends page loads**:
   - Login as a customer user
   - Navigate to `/friends`
   - Page should load without 404 errors

3. **Check network tab**:
   - Open browser developer tools
   - Go to Network tab
   - Refresh friends page
   - API calls should go to `/api/friends` not `/api/api/friends`

## Files Already Deployed

All implementation files are already deployed in production:

### Backend (Railway)
- ✅ `/api/friends` endpoints active
- ✅ Database migrations applied
- ✅ HubSpot sync service ready

### Frontend (Vercel)
- ✅ `/friends` page exists
- ✅ Navigation updated for customers
- ✅ All UI components ready

## No Code Changes Needed

The system is fully implemented and deployed. Only the Vercel environment variable needs to be updated.

## Alternative Quick Fix (if needed)

If you can't access Vercel settings immediately, you can hardcode the API URL temporarily:

1. Edit `/ClubOSV1-frontend/src/api/apiClient.ts`
2. Change line 6 from:
   ```typescript
   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
   ```
3. To:
   ```typescript
   const API_URL = 'https://clubosv2-production.up.railway.app';
   ```
4. Commit and push (will auto-deploy)

But the proper fix is updating the environment variable in Vercel.

---

**Status**: Implementation complete, just needs env var fix in Vercel
**Time to fix**: 2 minutes in Vercel dashboard