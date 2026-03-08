# ClubOS v1.25.48 - Facility Management System

Production system for Clubhouse 24/7 — managing golf simulators, pickleball courts, gyms, and other facilities with AI-powered customer support, automated operations, and remote facility control.

**Production URL**: https://club-osv-2-owqx.vercel.app

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS → Vercel
- **Backend**: Node.js, Express, PostgreSQL, Redis → Railway
- **AI**: OpenAI GPT-4 Assistants, V3-PLS Pattern Learning System
- **Integrations**: OpenPhone, Slack, NinjaOne, HubSpot, UniFi

## Core Features

### AI & Automation
- **V3-PLS Pattern Learning**: Auto-learns from operator responses with configurable confidence thresholds
- **GPT-4 Assistant Routing**: Emergency, Booking, Tech Support, Brand Tone assistants
- **Topic-Aware Responses**: Smart detection of booking, tech support, access, gift cards, hours, pricing
- **Knowledge Management**: Natural language updates, searchable archive

### Operations Management
- **Tickets**: Location-based tracking, photo attachments, priority workflow
- **Checklists**: Supplies tracking, people task lists, QR codes, performance metrics
- **Remote Control**: NinjaOne device management, UniFi door access (6 locations)
- **Messages**: Two-way SMS via OpenPhone, AI suggestions, operator lockouts

### User Roles

| Role | Access Level | Primary Functions |
|------|-------------|-------------------|
| Admin | Full | System configuration, analytics |
| Operator | Operations | Tickets, messages, patterns |
| Support | Limited | Customer support, ClubOS Boy |
| Customer | Portal | Profile, bookings |
| Contractor | Checklists | Cleaning tasks, door access |
| Kiosk | Public | ClubOS Boy interface |

## Project Structure

```
ClubOSV1/
├── ClubOSV1-frontend/       # Next.js application (Vercel)
├── ClubOSV1-backend/        # Express API server (Railway)
├── scripts/                 # Deployment, migration, and utility scripts
├── docs/                    # Technical documentation
├── config/                  # Environment templates
├── CLAUDE.md                # AI assistant context (technical map)
├── CHANGELOG.md             # Version history
└── README.md                # This file
```

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

```bash
# Local Development
cd ClubOSV1-backend && npm run dev   # Terminal 1 (port 3000)
cd ClubOSV1-frontend && npm run dev  # Terminal 2 (port 3001)

# Deploy to Production (auto-deploys on push)
git add -A && git commit -m "feat: description" && git push
```

## Common Commands

```bash
# Development
cd ClubOSV1-frontend && npm run dev  # Frontend (port 3001)
cd ClubOSV1-backend && npm run dev   # Backend (port 3000)

# Type checking
npx tsc --noEmit                     # Check TypeScript errors

# Database
npm run db:migrate                   # Run pending migrations
npm run db:rollback                  # Rollback last migration
railway run npm run db:migrate       # Production migration

# Logs
railway logs                         # Backend production logs
```

## Environment Setup

See [ENVIRONMENT.md](./ENVIRONMENT.md) for complete configuration guide.

## Security

- **Authentication**: JWT-based with role permissions
- **Encryption**: AES-256-GCM for sensitive data
- **Input Validation**: XSS/SQL injection prevention
- **Rate Limiting**: Configurable per endpoint
- **CSRF Protection**: Token validation
- **Security Headers**: CSP, HSTS, X-Frame-Options

## Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Setup and deployment guide
- [ENVIRONMENT.md](./ENVIRONMENT.md) - Environment variables reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [CLAUDE.md](./CLAUDE.md) - AI assistant technical context
- [/docs](./docs/) - Full technical documentation

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check token in localStorage, may need fresh login |
| TypeScript errors | Run `npx tsc --noEmit` to see all errors |
| Database connection | Verify DATABASE_URL in .env files |
| Port already in use | `lsof -i:3000` then `kill -9 <PID>` |
| Module not found | Run `npm install` in the affected directory |

## Support

- **Logs**: Backend `railway logs`, Frontend Vercel dashboard
- **Monitoring**: Sentry for errors, Railway for metrics

---

**Remember**: All commits auto-deploy to production. Test locally first.
