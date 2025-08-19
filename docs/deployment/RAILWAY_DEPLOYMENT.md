# Railway Backend Deployment Instructions

## Current Issue
The backend service is not running on Railway (returning 404/502 errors).

## Steps to Deploy Backend

### 1. Login to Railway Dashboard
- Go to https://railway.app
- Navigate to your project "dazzling-warmth"

### 2. Create/Connect Backend Service
If backend service doesn't exist:
1. Click "New Service"
2. Select "GitHub Repo" 
3. Choose the ClubOSV2 repository
4. Select the main branch

### 3. Configure Service Settings
Set the following in the service settings:

#### Build Configuration
- **Root Directory**: `/ClubOSV1-backend`
- **Build Command**: `npm run build`
- **Start Command**: `npm run start:prod`

#### Environment Variables (Required)
```
NODE_ENV=production
PORT=3001
DATABASE_URL=[from Postgres service]
JWT_SECRET=[your-secret-key]
ENCRYPTION_KEY=[32-character-key]
```

#### Environment Variables (Optional but Recommended)
```
OPENAI_API_KEY=[your-openai-key]
SLACK_WEBHOOK_URL=[your-slack-webhook]
OPENPHONE_API_KEY=[your-openphone-key]
OPENPHONE_DEFAULT_NUMBER=[your-phone-number]
```

### 4. Deploy
1. Click "Deploy" or push to main branch
2. Monitor logs for successful startup
3. Check health endpoint: https://[your-service].railway.app/api/health

## Verify Deployment

Test the following endpoints:
- Health: `curl https://clubosv2-production.up.railway.app/api/health`
- Should return: `{"status":"ok","timestamp":"...","uptime":...}`

## Troubleshooting

### If deployment fails:
1. Check logs in Railway dashboard
2. Verify all required environment variables are set
3. Ensure DATABASE_URL points to the Postgres service
4. Check that PORT is set (Railway provides this automatically)

### Common Issues:
- **Missing dependencies**: Ensure package.json has all dependencies
- **TypeScript errors**: Run `npm run typecheck` locally first
- **Database connection**: Verify DATABASE_URL is correct
- **Memory issues**: May need to increase service limits

## Current Service URLs
- Frontend: https://club-osv-2-owqx.vercel.app
- Backend: https://clubosv2-production.up.railway.app (needs deployment)
- Database: Internal Railway Postgres service