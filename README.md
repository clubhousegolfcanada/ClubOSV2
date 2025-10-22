# ClubOS v1.23.3 - Flexible Facility Management System

Production system for Clubhouse 24/7 - managing golf simulators, pickleball courts, gyms, and other facilities with AI-powered customer support, automated operations, and remote facility control.

**Production URL**: https://club-osv-2-owqx.vercel.app

## 🎯 Latest Updates

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

**Current Version: v1.23.3**
- **🔄 Booking Default** - Booking page now defaults to Skedda iframe for stability
- **🚨 Previous Fix** - Booking system handles missing database columns defensively (v1.23.2)
- **🎨 UI Consistency** - Standardized Operations-style sub-navigation (v1.23.1)
- **🚀 Performance** - 500+ customer optimization with Redis caching (v1.23.0)
- **✨ Mobile Optimization** - All sub-navs are mobile-responsive (v1.23.1)
- **🔧 Previous: Unified Booking** - Consolidated all booking modals (v1.22.11)

## 🏗️ System Architecture

### Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS → Vercel
- **Backend**: Node.js, Express, PostgreSQL → Railway
- **AI**: OpenAI GPT-4, Pattern Learning System
- **Integrations**: OpenPhone, Slack, NinjaOne, HubSpot, UniFi

## 🚀 Core Features

### AI & Automation
- **V3-PLS Pattern Learning**: Auto-learns from operator responses, 95% accuracy
- **GPT-4 Assistant Routing**: Emergency, Booking, Tech Support, Brand Tone
- **Automated Responses**: Configurable rules with confidence thresholds
- **Knowledge Management**: Natural language updates, searchable archive

#### Activating V3-PLS (Pattern Learning System)
```bash
# Step 1: Deploy to run migration (auto-deploys)
git push

# Step 2: Enable V3-PLS in production
railway run psql $DATABASE_URL < scripts/enable-v3-pls-production.sql

# Step 3: Use UI to enable patterns
# Go to Operations > V3-PLS Patterns
# Toggle ON trusted patterns (gift cards, etc.)
```

### Operations Management
- **Tickets**: Location-based tracking, photo attachments, priority workflow
- **Checklists**: Supplies tracking, QR codes, performance metrics
- **Remote Control**: NinjaOne devices, UniFi door access
- **Messages**: Two-way SMS, push notifications, AI suggestions

### Customer Experience
- **ClubCoin Economy**: Virtual currency for challenges and rewards
- **Head-to-Head Challenges**: Wagering system with tier progression
- **Leaderboards**: Seasonal competitions with achievements
- **TrackMan Integration**: Round verification, settings catalog

### User Roles
| Role | Access Level | Primary Functions |
|------|-------------|-------------------|
| Admin | Full | System configuration, analytics |
| Operator | Operations | Tickets, messages, patterns |
| Support | Limited | Customer support, ClubOS Boy |
| Customer | Portal | Profile, challenges, bookings |
| Contractor | Checklists | Cleaning tasks, door access |
| Kiosk | Public | ClubOS Boy interface |

## 📁 Project Structure

```
ClubOSV1/
├── ClubOSV1-frontend/       # Next.js application
├── ClubOSV1-backend/        # Express API server
├── scripts/                 # Deployment & utilities
├── docs/                    # Documentation
├── CLAUDE.md                # AI assistant context
├── QUICKSTART.md            # Setup guide
├── ENVIRONMENT.md           # Environment variables
├── CHANGELOG.md             # Version history
└── README.md                # This file
```

## 🚀 Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

```bash
# Local Development
cd ClubOSV1-backend && npm run dev   # Terminal 1
cd ClubOSV1-frontend && npm run dev  # Terminal 2

# Deploy to Production
git add -A && git commit -m "feat: description" && git push
```

## ⚡ Environment Setup

See [ENVIRONMENT.md](./ENVIRONMENT.md) for complete configuration guide.

## 🔧 Quick Reference

### Common Commands
```bash
# Start development
cd ClubOSV1-frontend && npm run dev  # Frontend (port 3001)
cd ClubOSV1-backend && npm run dev   # Backend (port 3000)

# Database operations
npm run db:migrate                   # Run pending migrations
npm run db:rollback                  # Rollback last migration
railway run npm run db:migrate       # Run migration in production

# Deployment (auto-deploys to production)
git add -A && git commit -m "fix: description" && git push

# Check logs
railway logs                         # Backend production logs
npx tsc --noEmit                     # TypeScript error check
```

### Important File Locations
| What | Where |
|------|-------|
| API Routes | `/ClubOSV1-backend/src/routes/` |
| React Components | `/ClubOSV1-frontend/src/components/` |
| Database Migrations | `/ClubOSV1-backend/src/database/migrations/` |
| Pattern Learning (V3-PLS) | `/ClubOSV1-backend/src/services/patterns/` |
| Message Handling | `/ClubOSV1-backend/src/services/openphone/` |
| Auth & Tokens | `/ClubOSV1-frontend/src/utils/tokenManager.ts` |

### Troubleshooting
| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token in localStorage, may need fresh login |
| TypeScript errors | Run `npx tsc --noEmit` to see all errors |
| Database connection | Verify DATABASE_URL in .env files |
| Port already in use | `lsof -i:3000` then `kill -9 <PID>` |
| Module not found | Run `npm install` in the affected directory |
| Migration needed | Check if recent changes need `npm run db:migrate` |

## 🔐 Security

- **Authentication**: JWT-based with role permissions
- **Encryption**: AES-256-GCM for sensitive data
- **Input Validation**: XSS/SQL injection prevention
- **Rate Limiting**: Configurable per endpoint
- **CSRF Protection**: Token validation
- **Security Headers**: CSP, HSTS, X-Frame-Options

## 📚 Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Setup and deployment guide
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment variables reference
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [CLAUDE.md](./CLAUDE.md) - AI assistant context
- [/docs](./docs/) - Technical documentation

## 🆘 Support

- **Issues**: Report at [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- **Logs**: Backend `railway logs`, Frontend Vercel dashboard
- **Monitoring**: Sentry for errors, Railway for metrics

---

**Remember**: Always commit and push when done - this auto-deploys to production.