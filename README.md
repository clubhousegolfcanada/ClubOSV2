# ClubOS v1.14.7 - AI-Powered Golf Simulator Management

Production system for Clubhouse 24/7 Golf - managing multiple golf simulator locations with AI-powered customer support, automated operations, and remote facility control.

## 🤖 Claude Context

**See CLAUDE.md for critical rules**. Production URL: https://clubos-frontend.vercel.app

## 🏗️ System Architecture

### Stack & Infrastructure
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS → Vercel (1-2 min deploys)
- **Backend**: Node.js, Express, PostgreSQL → Railway (2-3 min deploys)  
- **AI**: OpenAI GPT-4 + 4 Specialized Assistants
- **Monitoring**: Sentry (errors), Railway (logs)

### Core Features

#### 1. AI-Powered Operations
- **Smart Routing**: Customer questions → GPT-4 router → Specialized assistants
- **4 Assistants**: Emergency, Booking, Tech Support, Brand Tone
- **Knowledge System**: GPT-4o natural language updates, database-first search
- **OpenPhone**: Webhook integration, conversation extraction, statistics
- **AI Automations**: Configurable automated responses and actions
  - Gift card inquiries → Direct to purchase page (confidence: 0.5+)
  - Trackman/Simulator issues → Remote reset via NinjaOne
  - Hours/Membership questions → Instant automated responses
  - LLM analysis for all messages (not just initial)
  - Toggle features on/off, track usage statistics
- **Slack Fallback**: Human handoff when AI confidence low

#### 2. Operations Management
- **Tickets**: Tech/Facilities categories, priority workflow, Slack integration
- **Checklists**: Daily maintenance, auto-ticket creation, admin-only task editing
- **Remote Control**: 
  - NinjaOne integration for simulator/TV/music control
  - Ubiquiti UniFi Access for door control (Cloudflare tunnel ready - see [UniFi Setup Guide](./UNIFI-IMPLEMENTATION-GUIDE.md))
- **Analytics**: Usage tracking, performance metrics, cost monitoring
- **Messages**: 
  - Two-way SMS via OpenPhone with AI suggestions
  - Complete conversation history across all sessions
  - Real-time notifications, unread badges
  - International phone number support
  - Rate limiting: 30 msg/min, 10 API calls/sec
  - Push notifications for new messages (works in background)
- **Call Transcripts**: Extract knowledge from customer calls, searchable archive

#### 3. Clubhouse Challenges & Gamification (NEW v1.14.0)
- **ClubCoin Economy**: Non-monetary points for wagering on golf matches
- **Head-to-Head Challenges**: 30/70 stake split (challenger/acceptor)
- **8-Tier Rank System**: House → Amateur → Bronze → Silver → Gold → Pro → Champion → Legend
- **Seasonal Competitions**: 3-month seasons with resets and archives
- **18 Achievement Badges**: Automatic awarding based on performance
- **TrackMan Integration**: Settings catalog and round verification
- **Leaderboards**: Seasonal, all-time, and activity-based rankings
- **Champion Markers**: Tournament winners get 20% defeat bonus
- **Rate Limiting**: Anti-spam measures based on credibility scores

#### 4. User System
| Role | Access | Key Features |
|------|--------|--------------|
| Admin | Full system | Knowledge management, all operations |
| Operator | Operations | Tickets, checklists, basic analytics |
| Support | Limited | Commands, ClubOS Boy, no sensitive ops |
| Kiosk | Public only | ClubOS Boy terminal interface |
| Customer | Customer portal only | Profile, bookings, events, friends (WHITELIST ENFORCED) |

## 📁 Project Structure & Patterns

```
ClubOSV1/
├── ClubOSV1-frontend/          # Next.js app
│   ├── src/pages/              # Routes (each = menu item)
│   ├── src/components/         # Shared components
│   └── src/state/              # Zustand store
├── ClubOSV1-backend/           # Express API
│   ├── src/routes/             # API endpoints
│   ├── src/middleware/         # Auth, rate limiting
│   └── src/database/migrations/# Schema changes
├── scripts/                    # All operational scripts (ORGANIZED)
│   ├── dev/                    # Development scripts
│   ├── deploy/                 # Deployment scripts
│   ├── test/                   # Test scripts
│   ├── utils/                  # Utility scripts
│   └── security/               # Security scripts
├── docs/                       # All documentation (ORGANIZED)
│   ├── architecture/           # System design docs
│   ├── deployment/             # Deployment guides
│   ├── development/            # Dev guides & standards
│   ├── features/               # Feature documentation
│   └── archive/                # Old/deprecated docs
├── CLAUDE.md                   # Your context doc (MUST READ)
└── README.md                   # This file
```

### Key Files
- **Navigation**: `/frontend/src/components/Navigation.tsx` - Add new pages here
- **Auth**: `/backend/src/middleware/auth.ts` - All routes need auth except `/api/public/*`
- **Main API**: `/backend/src/index.ts` - Mount new routes here
- **Migrations**: Create in `/backend/src/database/migrations/` for DB changes

## 🚀 Development Workflow

```bash
# Local Development
cd ClubOSV1-backend && npm run dev   # Terminal 1
cd ClubOSV1-frontend && npm run dev  # Terminal 2
# Visit http://localhost:3000

# Deploy to Production
git add -A
git commit -m "feat/fix/chore: Description"
git push origin main
# Auto-deploys: Frontend → Vercel, Backend → Railway
```

### Common Commands
```bash
# Backend
npm run create:admin     # Create admin user
npm run test            # Run tests
npm run test:coverage   # Run tests with coverage report
railway logs            # Check production logs

# Frontend
npm test                # Run tests
npm run test:coverage   # Run tests with coverage report
npm run test:watch      # Run tests in watch mode

# Check deployment status
# Frontend: https://vercel.com/dashboard
# Backend: https://railway.app/dashboard
```

## 🔐 Security

### Security Features
- **Next.js 15.4.5**: Latest version with all security patches
- **CSRF Protection**: Custom implementation with token validation
- **Security Headers**: X-Frame-Options, CSP, HSTS enabled
- **Input Sanitization**: XSS prevention on all user inputs
- **Rate Limiting**: Configurable limits on all endpoints
- **Environment Validation**: Secure configuration checks on startup
- **Security Tests**: Comprehensive test suite for common vulnerabilities

### Security Verification
Run the security verification script to check your security posture:
```bash
./verify-security.sh
```

## 📊 Current State (August 2025)

### Latest
- **v1.14.7**: Fixed Customer App Loading & Navigation Issues
  - Removed broken wallet link
  - Fixed dashboard leaderboard routing
  - Cleared stale service worker cache
- **v1.14.6**: Enhanced New User Experience & Social Features
  - 100 ClubCoins for new signups
  - All-Time leaderboard with friend requests
  - Improved challenges UI in Friends page
- **v1.14.5**: Fixed Customer Leaderboard TrackMan Embeds
  - Updated Pro League and House League embed URLs
  - Added "Closest to the Pin" competition tab
  - All TrackMan leaderboards now functional
- **v1.14.4**: Fixed Customer App Background Resume Issue
  - Fixed infinite loading when returning from background
  - Prevented operator dashboard flash for customers
  - Added proper mobile app visibility handling
- **v1.14.3**: Major Codebase Standardization
  - Organized 34 root files into proper directories
  - Created standardized `/scripts` structure (dev, deploy, test, utils, security)
  - Organized documentation into `/docs` subdirectories
  - Cleaned root directory (now only 9 essential files)
  - Added standardization audit and progress tracking
  - Improved project maintainability score from 5/10 to 7/10
- **v1.14.2**: Restored TrackMan leaderboards, moved challenges to Friends page
- **v1.14.1**: Fixed backend compilation and deployed challenge tables to production
- **v1.14.0**: Clubhouse Challenges System
  - Complete challenge system with ClubCoin economy
  - 8-tier rank ladder with seasonal resets
  - Head-to-head wagering with 30/70 stake splits
  - 18 achievement badges with clubhouse tone
  - Champion markers for tournament winners
  - TrackMan integration for automatic verification
  - See [Implementation Plan](./CLUBHOUSE-CHALLENGES-IMPLEMENTATION-PLAN.md)

### Recent Changes
- **v1.12.0**: UniFi Access Cloudflare Tunnel Integration (Ready for Deployment)
  - Complete refactor to use Cloudflare tunnels instead of port forwarding
  - CloudflareTunnelManager service for multi-location support
  - Enhanced UniFiAccessService with caching and health monitoring
  - Migration scripts and rollback procedures included
  - Comprehensive testing suite and implementation guide
  - See [Implementation Guide](./UNIFI-IMPLEMENTATION-GUIDE.md) for setup
- **v1.11.24**: UniFi Access API Integration for Dartmouth
  - Implemented official UniFi Developer API for door control
  - Added remote door unlock for Dartmouth location (office door)
  - Created multi-location infrastructure for future expansion
  - Bedford location requires UniFi OS authentication (pending)
- **v1.11.23**: Fixed Customer Names in Messages
  - Enhanced OpenPhone webhook to extract names from more fields
  - Added automatic HubSpot name sync service (runs every 5 min)
  - Fixed database update logic for customer names
- **v1.11.22**: UniFi Access Integration & Remote Controls
  - Fixed backend startup error with unifi-access ES module
  - Added door unlock buttons to Commands page for all locations
  - Integrated Ubiquiti UniFi Access for remote door control
  - Added projector control buttons (power, input, auto-size) for each bay
- **v1.11.21**: Critical Messaging Fixes
  - Fixed duplicate messages showing when only one was sent
  - Fixed customer names displaying as phone numbers
  - Added message deduplication in webhook handler
- **v1.11.20**: Push Notification Enhancements
  - Fixed vibration not working on mobile devices
  - Added action buttons and sound to notifications
- **v1.11.19**: Mobile Navigation & Messaging System Fixes
  - Added booking icon to mobile dashboard for quick access to Skedda
  - Fixed Splashtop Control button to properly open the app on mobile devices
  - Fixed message history not loading when selecting from dashboard
  - Fixed notification badges not clearing properly
  - Reduced polling frequencies to prevent rate limiting
- **v1.11.18**: Testing Infrastructure Phase 4
  - Added HubSpot integration tests (12 test cases)
  - Added Push Notification service tests (14 test cases)
  - Added comprehensive security vulnerability tests (20+ test cases)
  - Set up GitHub Actions CI/CD pipeline with automated testing
  - 19 total test files, ~100+ test cases
  - Automated security scanning and build verification
- **v1.11.17**: Testing Infrastructure Phase 3
  - Integration test suite for complete message flow
  - Fixed LLMService and AssistantService tests
  - 16 test files total, improved mock patterns
  - Enhanced test organization and documentation
- **v1.11.16**: Testing Infrastructure Phase 2
  - Comprehensive Messages API test suite with 18 tests
  - AI Automation service tests for pattern matching and routing
  - Improved test mocking patterns for middleware and services
  - Test coverage increased from 40% to ~45%
- **v1.11.15**: Testing Infrastructure Phase 1
  - Complete test environment setup with Jest configuration
  - Added comprehensive OpenPhone webhook test suite
  - Fixed test infrastructure and resource cleanup
  - Created detailed testing improvement plan (4 phases)
- **v1.11.14**: OpenPhone Integration Fixes
  - Fixed critical webhook data extraction for OpenPhone v3
  - Restored phone number and customer name display in Messages
  - Made OpenAI API key optional for application startup
  - Fixed snake_case/camelCase conversion issue breaking conversations
- **v1.11.13**: Performance & Monitoring Improvements
  - Consolidated database connections with performance tracking
  - Added comprehensive performance logging middleware
  - Created frontend logging service with production error tracking
  - New /api/admin/performance endpoint for system monitoring
  - Memory leak detection and slow query analysis
- **v1.11.12**: Critical Security Improvements & Dashboard Updates
  - Fixed hardcoded admin password vulnerability
  - Removed sensitive data logging from frontend
  - Implemented proper session validation
  - Enabled CSP and HSTS security headers
  - Added compact Messages card to desktop dashboard
  - See SECURITY-AUDIT-2025-08.md for security details
- **v1.11.11**: RemoteActionsBar Mobile Visibility
  - Enhanced visual contrast with darker background when expanded
  - Added accent border and shadow effects for prominence
  - Smooth animations for expanding/collapsing
- **v1.11.10**: Complete Conversation History
  - Shows all customer conversations across sessions
  - Visual separators between conversation sessions
  - Conversation count indicators
- **v1.11.7**: Enhanced Push Notifications
  - Support role now receives OpenPhone message notifications
  - Improved notification formatting and deep linking
  - Direct navigation to messages page on notification click
  - Test script for verifying push notification flow
- **v1.10.4**: Critical Security Updates
  - Updated Next.js to 15.4.5 (fixed critical vulnerabilities)
  - Implemented CSRF protection
  - Enhanced security headers and input validation
  - Added security test suite and verification tools
- **v1.10.3**: Enhanced Mobile Navigation
  - Quick access "Open Messages" button on dashboard
  - Native swipe navigation between pages
  - Visual indicators for swipe gestures
  - Unread message count badge
- **v1.10.2**: Mobile UX Improvements & Bug Fixes
  - Redesigned ticket page for better mobile experience
  - Fixed duplicate message display bug in messages window
  - Improved consistency across all pages
  - Enhanced touch targets and readability
- **v1.10.1**: Complete PWA Support - Fully installable app
  - Full Android/iOS PWA compliance with valid icons
  - Web app manifest configured for installability
  - Service worker with offline support
  - Push notification infrastructure ready
  - Background sync capabilities
- **v1.10.0**: AI-Assisted Messaging & Comprehensive Privacy
  - AI suggestions for customer messages with safety filters
  - OpenPhone call transcript analysis and knowledge extraction
  - GDPR compliance: data export, deletion, retention policies
  - AES-256 encryption for sensitive data
  - Phone number anonymization in logs
- **v1.9.1**: Push notification infrastructure (Phase 1 & 2 complete)
  - Database tables and migration ready
  - NotificationService with web-push integration
  - API endpoints for subscription management
  - OpenPhone webhook integration for message notifications
  - VAPID keys generated (need to be added to .env)
- **v1.9.0**: OpenPhone Messages integration, real-time chat interface, notification system
- **v1.8.5**: Knowledge system overhaul - replaced vector search with assistant routing
- **v1.8.4**: UI standardization - dashboard-style layouts everywhere

### Active Systems
- ✅ Live dashboard with facility status
- ✅ AI customer support (ClubOS Boy)
- ✅ Ticket system with priorities
- ✅ Knowledge management with audit trail
- ✅ Remote control via NinjaOne
- ✅ OpenPhone conversation analysis
- ✅ Feedback tracking
- ✅ Two-way SMS messaging interface
- ✅ Push notifications for new messages (background notifications supported)

### Environment Variables

⚠️ **IMPORTANT**: See `ENVIRONMENT-SETUP.md` for critical setup instructions!

**Frontend** (.env.local):
- `NEXT_PUBLIC_API_URL` - Backend URL
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` - Push notification public key (REQUIRED for notifications)

**Backend** (.env):
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - GPT-4 access
- `SLACK_WEBHOOK_URL` - Support notifications
- `JWT_SECRET` - Auth tokens
- `OPENPHONE_API_KEY` - SMS messaging
- `OPENPHONE_WEBHOOK_SECRET` - Webhook verification
- `OPENPHONE_DEFAULT_NUMBER` - Default sending number
- `ENCRYPTION_KEY` - Data encryption key (REQUIRED for privacy features)
- `VAPID_PUBLIC_KEY` - Push notification public key (REQUIRED for notifications)
- `VAPID_PRIVATE_KEY` - Push notification private key (REQUIRED for notifications)
- `VAPID_EMAIL` - mailto: contact for push service (REQUIRED for notifications)
- **UniFi/Cloudflare** (Optional - for door control):
  - `UNIFI_USE_CLOUDFLARE` - Enable Cloudflare tunnels (set to `true` when ready)
  - `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
  - `CLOUDFLARE_API_TOKEN` - Cloudflare API token
  - See `.env.cloudflare.example` for complete UniFi configuration
- See `.env.example` for complete list

**Generate VAPID Keys**:
```bash
cd ClubOSV1-backend
node scripts/generate-vapid-keys.js
```

## 🔧 Common Tasks

### Add New Page
1. Create `/frontend/src/pages/newpage.tsx`
2. Add to `/components/Navigation.tsx`
3. Implement role checks (copy from existing pages)
4. Follow design patterns (container spacing, headers)

### Add API Endpoint  
1. Create `/backend/src/routes/feature.ts`
2. Import in `/backend/src/index.ts`
3. Apply auth middleware
4. Add rate limiting if public-facing

### Database Changes

#### New Migration System (v2)
```bash
# Check migration status
npm run db:status

# Run pending migrations
npm run db:migrate

# Preview migrations without executing
npm run db:migrate:dry

# Rollback last migration
npm run db:rollback

# Validate migration checksums
npm run db:validate

# Reset database (DEV ONLY)
npm run db:reset
```

#### Creating New Migrations
1. Create file: `/backend/src/database/migrations/XXX_description.sql`
2. Include UP and DOWN sections for rollback support:
```sql
-- UP
CREATE TABLE example (...);

-- DOWN
DROP TABLE example;
```
3. Test locally before deploying
4. Migrations run automatically on deploy

## 🚨 Important Patterns

### UI/UX Standards
- Mobile-first responsive design
- Simple on/off switches (no percentages)
- Container: `px-3 sm:px-4 py-6 sm:py-8`
- Headers: `text-2xl md:text-3xl font-bold mb-2`
- Clear visual feedback for all actions

### Security
- All routes authenticated except `/api/public/*`
- Rate limiting on all endpoints
- Role-based access control
- Input validation and sanitization
- AES-256-GCM encryption for sensitive data
- Customer safety filter for AI responses
- Comprehensive audit logging
- GDPR-compliant data handling

### Error Handling
- User-friendly error messages
- Log to Sentry in production
- Fallback to Slack for critical issues
- Always test error paths

## 📚 Documentation

### Core Documentation
- **CLAUDE.md** - User preferences, working style (MUST READ)
- **CHANGELOG.md** - Version history
- **PUBLIC_CLUBOSBOY_SETUP.md** - Public embed instructions
- **UNIFI-ACCESS-SETUP.md** - UniFi door control setup guide
- **API Docs** - `/ClubOSV1-backend/docs/`
- **TESTING-GUIDE.md** - Comprehensive testing instructions
- **SECURITY-AUDIT-REPORT.md** - Latest security audit findings

### Security Documentation
- **ENVIRONMENT-SETUP.md** - Critical environment variable setup
- **SECURITY-IMPLEMENTATION-GUIDE.md** - Complete security implementation steps
- **SECURITY-QUICK-REFERENCE.md** - Security commands and procedures
- **SECURITY-QUICK-WINS.md** - Quick security fixes
- **TESTING-SECURITY-ROADMAP.md** - Future security enhancements

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection error | Check DATABASE_URL in Railway |
| OpenAI errors | Verify API key and billing |
| Slack not working | Check webhook URL |
| Login issues | Clear browser cache |
| Deploy failed | Check Vercel/Railway dashboards |

## 🔮 Roadmap

### In Development
- Multi-facility support planning
- Enhanced analytics dashboard

### Ready to Implement
- **Public ClubOS Boy** - HubSpot embed ready, see `PUBLIC_CLUBOSBOY_SETUP.md`

---

**Remember**: You have full autonomy. The system has good error tracking and automatic rollbacks. Move fast, test when possible, and always commit + push when done.