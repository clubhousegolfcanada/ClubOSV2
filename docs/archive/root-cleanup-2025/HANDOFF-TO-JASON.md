# ClubOS V1 - Project Handoff Documentation for Jason

## 🚨 CRITICAL SECURITY ISSUE - ACTION REQUIRED IMMEDIATELY

### Production Credentials Exposed in Git Repository
**IMMEDIATE ACTION REQUIRED:**
1. The `.env` file with ALL production credentials is currently tracked in git
2. Database password, API keys, and tokens are fully exposed
3. **Rotate ALL credentials TODAY before proceeding with anything else**

**Exposed Credentials to Rotate:**
- PostgreSQL Database Password
- HubSpot API Key
- UniFi Access Tokens
- Slack Webhook URL
- VAPID Keys for Push Notifications
- JWT and Session Secrets

**Steps to Fix:**
```bash
# Remove .env from git tracking
cd ClubOSV1-backend
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Remove .env file from version control"
git push
```

## Project Overview

**ClubOS V1** is a comprehensive golf club management system with customer engagement features, tournament management, and business operations tools.

### Tech Stack
- **Frontend:** Next.js 15.4.5, React, TypeScript, TailwindCSS
- **Backend:** Node.js, Express, TypeScript, PostgreSQL
- **Deployment:** Railway (production), Vercel (frontend)
- **Integrations:** HubSpot, OpenPhone, UniFi Access, TrackMan

## Current Status

### Working Features ✅
- User authentication and role management
- Customer profiles and Club Coin system
- Friend system and social features
- Tournament and challenge system
- Messaging integration with OpenPhone
- Basic booking rewards
- Leaderboard and achievements

### Known Issues 🔴

#### High Priority Bugs
1. **Backend Build Errors** (3 TypeScript errors)
   - Missing `getUserByEmail` method
   - bcrypt import issue
   - `is_active` property type error
   - Location: `ClubOSV1-backend/src/routes/auth.ts:475-493`

2. **Test Suite Failures**
   - 18 failing tests in messages API
   - Primarily response format and database schema issues

3. **Uncommitted Files**
   - `fix-missing-customer-profiles.js` - Script to fix customer profile issues
   - `fix-alanna-data.sql` - SQL to fix specific user data

#### Medium Priority Issues
1. **81 files with console.log statements** need proper logging
2. **Password reset functionality** not implemented
3. **GPT webhook handlers** temporarily disabled
4. **HubSpot webhook signature verification** disabled
5. **Multiple TODO items** across the codebase

## Technical Debt Summary

### Critical TODOs
1. **Authentication:** Password reset email system (`auth.ts:213`)
2. **AI Automation:** TrackMan device mapping (`aiAutomationService.ts:1296`)
3. **Usage Tracking:** 10+ unimplemented endpoints (`usage.ts`)
4. **Friend System:** Email/SMS invitations (`friends.ts:295`)

### Debug Code to Clean
- 61 frontend files with console statements
- 20 backend files with console usage
- Message filtering temporarily disabled
- Various test endpoints stubbed out

## Database Schema

### Recent Changes
- Consolidated dual users tables into single `users` table
- Added comprehensive migration system (200+ baseline)
- Customer profiles table properly linked to users
- All foreign key constraints verified

### Migration Status
- Latest: `200_consolidated_production_baseline.sql`
- Some migrations marked as `.skip` or `.broken`
- Archived migrations in `archived_2025_08_24` folder

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
JWT_SECRET=(generate strong 32+ char secret)
SESSION_SECRET=(generate strong 32+ char secret)

# Integrations
HUBSPOT_API_KEY=
OPENPHONE_API_KEY=
UNIFI_API_KEY=
SLACK_WEBHOOK_URL=

# Push Notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Railway
RAILWAY_PROJECT_ID=
```

## Deployment Process

### Backend (Railway)
```bash
# Automatic deployment on push to main
git add -A
git commit -m "Your message"
git push

# Manual deployment
railway up
```

### Frontend (Vercel)
- Auto-deploys from main branch
- Preview deployments for PRs

## API Documentation

### Base URLs
- **Production Backend:** Railway deployment URL
- **Production Frontend:** Vercel deployment URL
- **Local Development:** 
  - Backend: http://localhost:3001
  - Frontend: http://localhost:3000

### Key Endpoints
- `/api/auth/*` - Authentication
- `/api/v2/customer/*` - Customer features
- `/api/messages/*` - Messaging system
- `/api/admin/*` - Admin functions
- `/api/public/*` - No auth required

## Setup Instructions

### Local Development
```bash
# Backend
cd ClubOSV1-backend
npm install
cp .env.example .env  # Configure with your values
npm run dev

# Frontend
cd ClubOSV1-frontend
npm install
cp .env.example .env.local  # Configure with your values
npm run dev
```

### Running Tests
```bash
# Backend tests (currently failing)
cd ClubOSV1-backend
npm test

# Frontend build check
cd ClubOSV1-frontend
npm run build
```

## Monitoring & Logs

### Health Checks
- Backend: `/api/health`
- Database: `/api/health/db`
- Dependencies: `/api/health/dependencies`

### Error Tracking
- Sentry integration configured (needs instrumentation file)
- Custom error logging in place

## Contact & Resources

### Documentation Files
- `README.md` - Main project documentation
- `CHANGELOG.md` - Detailed change history
- `CLAUDE.md` - AI assistant instructions
- Various `*-PLAN.md` files for feature implementations

### Support Channels
- GitHub Issues for bug tracking
- Railway dashboard for deployment monitoring
- Vercel dashboard for frontend deployments

## Recommended Next Steps

### Day 1 - Critical Security
1. ✅ Rotate ALL production credentials
2. ✅ Remove .env from git tracking
3. ✅ Update Railway environment variables
4. ✅ Verify no credentials in git history

### Week 1 - Stabilization
1. Fix the 3 backend TypeScript build errors
2. Address failing test suite
3. Implement password reset functionality
4. Re-enable security features (webhook verification)
5. Commit the two uncommitted files

### Week 2 - Cleanup
1. Replace console.log with proper logging
2. Complete high-priority TODO items
3. Remove debug code and temporary fixes
4. Update documentation

### Month 1 - Enhancement
1. Complete usage tracking system
2. Implement friend system notifications
3. Add comprehensive test coverage
4. Performance optimization

## Production Checklist Before Going Live

- [ ] All credentials rotated and secured
- [ ] Build errors resolved
- [ ] Test suite passing
- [ ] Console statements removed
- [ ] Security features enabled
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Rate limiting configured
- [ ] Error handling standardized

## Notes on Code Quality

### Strengths
- Well-structured architecture
- Comprehensive feature set
- Good separation of concerns
- Role-based access control

### Areas for Improvement
- Test coverage needs expansion
- Error handling consistency
- Logging infrastructure
- TypeScript strict mode adoption

---

*Generated: August 24, 2025*
*Last Commit: c89379a - fix: competitors tab not showing friends*
*Uncommitted Changes: 2 files (customer profile fix script, Alanna data SQL)*

## Emergency Contacts
- Railway Support: via dashboard
- Vercel Support: via dashboard
- Database: PostgreSQL on Railway

Good luck with the project! The codebase is comprehensive but needs immediate security attention and some stabilization work before it's fully production-ready.