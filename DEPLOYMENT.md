# ClubOS Deployment Guide

## Overview
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Express)
- **Database**: PostgreSQL (Railway)
- **Repository**: GitHub (auto-deploys on push)

## Pre-Deployment Checklist

### Security Requirements
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Generate strong SESSION_SECRET
- [ ] Set NODE_ENV=production
- [ ] Configure CORS with specific domains
- [ ] Disable debug mode
- [ ] Review rate limiting settings

### Required Environment Variables

#### Frontend (Vercel)
```bash
NEXT_PUBLIC_API_URL=https://your-railway-app.railway.app/api
```

#### Backend (Railway)
```bash
# Core Configuration (Required)
NODE_ENV=production
JWT_SECRET=your-32-char-secret-key  # Must be 32+ characters
SESSION_SECRET=your-session-secret  # Must be 32+ characters
PORT=3001

# Optional Configuration
FRONTEND_URL=https://your-app.vercel.app  # Optional, defaults to http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_SIGNING_SECRET=your-webhook-secret

# OpenAI Configuration
OPENAI_API_KEY=sk-...
BOOKING_ACCESS_GPT_ID=asst_YeWa98dP4Dv0eXwyjMsCHeE7  # Configured ✅
EMERGENCY_GPT_ID=asst_xxxxx  # Configured ✅
TECH_SUPPORT_GPT_ID=asst_xxxxx  # Configured ✅
BRAND_MARKETING_GPT_ID=asst_xxxxx  # Configured ✅

# Optional Settings
OPENAI_MODEL=gpt-4-turbo-preview
PORT=3001
```

## Deployment Steps

### 1. Backend Deployment (Railway)

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Add PostgreSQL Database**
   - In Railway dashboard: Add Service → Database → PostgreSQL
   - Copy DATABASE_URL to environment variables

3. **Configure Environment Variables**
   - Go to Variables tab
   - Add all required environment variables
   - GPT Assistant IDs are already configured ✅

4. **Deploy**
   ```bash
   cd ClubOSV1-backend
   railway up
   ```

5. **Get Deployment URL**
   - Check Railway dashboard for deployment URL
   - Update frontend configuration

### 2. Frontend Deployment (Vercel)

1. **Import to Vercel**
   - Connect GitHub repository
   - Set root directory: `ClubOSV1-frontend`
   - Configure environment variables

2. **Environment Variables**
   - Add `NEXT_PUBLIC_API_URL` pointing to Railway backend

3. **Deploy**
   - Push to GitHub triggers auto-deployment
   - Or use: `vercel --prod`

4. **Configure Custom Domain** (optional)
   - Add domain in Vercel dashboard
   - Update DNS records

### 3. Post-Deployment Setup

1. **Create Admin User**
   ```bash
   # Run the admin creation script
   cd ClubOSV1-backend
   npm run create:admin
   ```

2. **Initialize System Configurations**
   - System configurations are auto-initialized on first startup
   - Check Operations page → System Config tab

3. **Verify Integrations**
   - [ ] Test authentication flow
   - [ ] Test Slack notifications
   - [ ] Test OpenAI routing
   - [ ] Test all GPT assistants
   - [ ] Verify database connectivity

## Monitoring & Maintenance

### Health Checks
- Backend: `https://your-backend.railway.app/health`
- Frontend: Check Vercel dashboard

### Logs
- **Railway**: `railway logs` or check dashboard
- **Vercel**: Function logs in dashboard
- **Application logs**: Check `/api/access/logs` endpoint (admin only)

### Database Backups
- Railway PostgreSQL includes automatic daily backups
- Manual backup: Use Operations page → Backup feature

## Deployment Commands

```bash
# Full deployment from root directory
cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# 1. Check status
git status

# 2. Add and commit changes
git add .
git commit -m "deployment: description of changes"

# 3. Push (triggers auto-deploy)
git push origin main

# 4. Monitor deployments
# - Check Vercel dashboard for frontend status
# - Check Railway dashboard for backend status
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Verify FRONTEND_URL in Railway env vars
   - Check CORS configuration in backend

2. **Authentication Failures**
   - Ensure JWT_SECRET matches between deployments
   - Check token expiration settings

3. **Database Connection Issues**
   - Verify DATABASE_URL is correct
   - Check Railway PostgreSQL is running

4. **GPT Assistant Errors**
   - Assistant IDs are configured in Railway ✅
   - Verify OpenAI API key is valid
   - Check API rate limits
   - Check Railway logs for specific errors

### Rollback Procedures

1. **Vercel**: Use instant rollback in dashboard
2. **Railway**: Rollback to previous deployment
3. **Database**: Railway provides point-in-time recovery

## Production Best Practices

1. **Security**
   - Rotate secrets regularly
   - Use environment-specific API keys
   - Enable 2FA on all service accounts

2. **Performance**
   - Monitor response times
   - Set up alerts for errors
   - Use caching where appropriate

3. **Backup Strategy**
   - Daily automated PostgreSQL backups
   - Weekly manual system backups
   - Test restore procedures monthly

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│   Railway    │────▶│ PostgreSQL  │
│  (Frontend) │     │  (Backend)   │     │ (Database)  │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   External   │
                    │   Services   │
                    ├──────────────┤
                    │ • OpenAI     │
                    │ • Slack      │
                    │ • TrackMan   │
                    └──────────────┘
```

## Contact & Support

For deployment issues:
- Check Railway and Vercel status pages
- Review application logs
- Contact system administrator

Last updated: July 2025