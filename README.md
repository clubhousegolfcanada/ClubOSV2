# ClubOS v1.20.21 - AI-Powered Golf Simulator Management

Production system for Clubhouse 24/7 Golf - managing multiple golf simulator locations with AI-powered customer support, automated operations, and remote facility control.

**Production URL**: https://clubos-frontend.vercel.app

## 🎯 Latest Updates

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

**Current Version: v1.20.21**
- Enhanced mobile dashboard user experience
- Bay status card hidden on mobile devices
- Messages card now collapsible with state persistence
- Shows unread count badge when collapsed
- Smooth animations for better UX

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