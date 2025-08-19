# Public ClubOS Boy Setup Reference
**Created: July 30, 2025**

## Overview
This document contains all the information needed to set up the public ClubOS Boy interface when you're ready to implement it on HubSpot.

## What's Already Built
✅ **Frontend**: Public page at `/public/clubosboy` (no auth required)
✅ **Backend**: API endpoint at `/api/public/clubosboy` with rate limiting
✅ **Database**: Migration for `public_requests` table ready to run
✅ **Documentation**: Full HubSpot integration guide at `/docs/HUBSPOT_INTEGRATION.md`

## Quick Setup When Ready

### 1. Verify Everything is Working
```bash
# Test the public interface locally
https://localhost:3000/public/clubosboy

# Test on production
https://clubos-frontend.vercel.app/public/clubosboy
```

### 2. HubSpot Embed Code
```html
<iframe 
  src="https://clubos-frontend.vercel.app/public/clubosboy" 
  width="100%" 
  height="800"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="ClubOS Boy - AI Golf Assistant">
</iframe>
```

### 3. Required Environment Variables
Make sure these are set in production:
- `OPENAI_API_KEY` - For AI responses
- `OPENAI_ASSISTANT_ID` or `CLUBOS_BOY_ASSISTANT_ID` - The assistant to use

### 4. Database Migration
The migration will run automatically on deployment, but if needed:
```sql
-- Creates public_requests table for analytics
-- File: /src/database/migrations/015_create_public_requests_table.sql
```

## Key Features to Test

### Before Going Live
- [ ] Form submits without login
- [ ] Rate limiting works (10 requests/minute)
- [ ] SMS button opens text app with 9027073748
- [ ] Form auto-clears after 60 seconds
- [ ] Responses come from AI assistant
- [ ] Error messages show phone number for fallback

### Mobile Testing
- [ ] SMS link works on iOS
- [ ] SMS link works on Android
- [ ] Touch targets are large enough
- [ ] Responsive design looks good

## Analytics You'll Get

The system tracks:
- Total daily requests
- Unique visitors (IP-based)
- Questions asked
- Response times
- Source (hubspot vs direct)

View analytics with:
```sql
SELECT * FROM public_requests_daily_stats;
```

## Security Notes

**Rate Limiting**: 10 requests per minute per IP
**Max Question Length**: 500 characters
**No Auth Required**: Completely public
**Logging**: All requests logged with IP

## Customization Options

### Change Rate Limits
Edit `/src/middleware/publicRateLimiter.ts`:
```typescript
max: 10, // requests per minute
windowMs: 1 * 60 * 1000, // 1 minute
```

### Modify Auto-Timeout
Edit `/src/pages/public/clubosboy.tsx`:
```typescript
}, 60000); // 60 seconds (change this number)
```

### Update Contact Info
Edit `/src/pages/public/clubosboy.tsx` to change:
- Phone number
- Email address
- Instagram handle

## Troubleshooting Checklist

If something doesn't work:
1. Check migrations ran: `SELECT * FROM public_requests LIMIT 1;`
2. Verify env variables are set
3. Check rate limiting isn't blocking: Clear browser cache/cookies
4. Test API directly: `POST /api/public/clubosboy`
5. Check browser console for CORS errors

## Contact for Help
When implementing, if you need help:
- The code is already committed and deployed
- All files are in place
- Just need to embed the iframe in HubSpot

## File Locations
- Frontend: `/ClubOSV1-frontend/src/pages/public/clubosboy.tsx`
- Backend: `/ClubOSV1-backend/src/routes/public.ts`
- Rate Limiter: `/ClubOSV1-backend/src/middleware/publicRateLimiter.ts`
- Migration: `/ClubOSV1-backend/src/database/migrations/015_create_public_requests_table.sql`
- Full Docs: `/docs/HUBSPOT_INTEGRATION.md`

---
**Remember**: Everything is already built and deployed. When you're ready, just add the iframe to HubSpot!