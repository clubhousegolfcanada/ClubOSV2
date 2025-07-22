# ClubOS Production Deployment Checklist

## Pre-Deployment

### Security
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Generate strong SESSION_SECRET
- [ ] Set NODE_ENV=production
- [ ] Configure CORS with specific domains
- [ ] Disable debug mode
- [ ] Review rate limiting settings

### API Keys
- [ ] OpenAI API key set
- [ ] Slack webhook configured
- [ ] Slack signing secret set
- [ ] All assistant IDs configured

### Frontend Environment
- [ ] API URL points to Railway backend
- [ ] All external tool URLs configured
- [ ] Remove any localhost references

### Backend Environment
- [ ] Database connection string (if using PostgreSQL)
- [ ] Persistent volume mounted at /data
- [ ] Proper error logging configured

## Deployment Steps

### 1. Frontend (Vercel)
- [ ] Push code to GitHub
- [ ] Import project to Vercel
- [ ] Set root directory to `ClubOSV1-frontend`
- [ ] Configure all environment variables
- [ ] Deploy and get URL
- [ ] Configure custom domain
- [ ] Test deployment

### 2. Backend (Railway)
- [ ] Create Railway project
- [ ] Add PostgreSQL database (optional)
- [ ] Add persistent volume
- [ ] Configure environment variables
- [ ] Deploy with `railway up`
- [ ] Get deployment URL
- [ ] Test API endpoints

### 3. Post-Deployment
- [ ] Update frontend API_URL to Railway URL
- [ ] Test authentication flow
- [ ] Test Slack integration
- [ ] Test OpenAI integration
- [ ] Create admin user
- [ ] Test all external tool links
- [ ] Monitor logs for errors

## First-Time Setup Commands

```bash
# After deployment, create admin user
curl -X POST https://your-backend.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TEMP_ADMIN_TOKEN" \
  -d '{
    "email": "admin@yourcompany.com",
    "password": "SecurePassword123!",
    "name": "Admin User",
    "phone": "+1234567890",
    "role": "admin"
  }'
```

## Monitoring

- [ ] Set up error monitoring (Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up backup strategy
- [ ] Document deployment process

## Rollback Plan

1. Vercel: Instant rollback via dashboard
2. Railway: Previous deployment available
3. Keep backup of working environment variables
4. Document any database migrations
