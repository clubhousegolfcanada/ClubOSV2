# ClubOS Deployment Notes

## Current Setup
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Express)
- **Repository**: GitHub (auto-deploys on push)

## Important Considerations

### Data Persistence on Railway
Railway containers are ephemeral - local files don't persist between deployments. 

**Current Issue**: The backup/restore system uses local JSON files which will be lost on each deployment.

### Solutions:

#### Option 1: Railway Volumes (Recommended for now)
1. Go to your Railway project dashboard
2. Navigate to your service settings
3. Add a Volume:
   - Mount path: `/app/src/data`
   - Size: 1GB (or as needed)
4. Redeploy the service

#### Option 2: External Database (Best for production)
Consider migrating to:
- PostgreSQL (Railway provides this)
- MongoDB Atlas
- Supabase

#### Option 3: Cloud Storage for Backups
- AWS S3
- Google Cloud Storage
- Cloudflare R2

## Environment Variables

### Vercel (Frontend)
```
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app/api
```

### Railway (Backend)
```
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app
JWT_SECRET=your-secret-key
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_WEBHOOK_SECRET=your-webhook-secret

# Optional (system works without these)
OPENAI_API_KEY=sk-...
BOOKING_ACCESS_GPT_ID=asst_...
EMERGENCY_GPT_ID=asst_...
TECH_SUPPORT_GPT_ID=asst_...
BRAND_MARKETING_GPT_ID=asst_...
```

## Deployment Commands

```bash
# 1. Ensure you're in the root directory
cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# 2. Check status
git status

# 3. Add changes
git add .

# 4. Commit
git commit -m "your commit message"

# 5. Push (triggers auto-deploy)
git push origin main

# 6. Monitor deployments
# - Check Vercel dashboard for frontend
# - Check Railway dashboard for backend
```

## Post-Deployment Checks

1. **Test Authentication**:
   - Login works
   - Tokens are valid
   - CORS is configured correctly

2. **Test Backup/Restore**:
   - Create a backup
   - Download the file
   - Restore from backup
   - Verify data persistence

3. **Check Logs**:
   - Railway: `railway logs`
   - Vercel: Check function logs in dashboard

## Known Issues

1. **Data Loss on Deploy**: Without volumes or external storage, all JSON data is lost when Railway redeploys

2. **CORS**: Make sure your production URLs are in the CORS whitelist in `backend/src/index.ts`

3. **File Uploads**: The backup restore feature uploads files - ensure Railway allows this

## Recommendations

1. **Set up Railway Volumes** immediately to prevent data loss
2. **Plan migration** to a proper database solution
3. **Set up monitoring** for both services
4. **Enable backups** on Railway if using their database
