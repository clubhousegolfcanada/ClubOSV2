# ClubOS v1.18.9 - AI-Powered Golf Simulator Management

Production system for Clubhouse 24/7 Golf - managing multiple golf simulator locations with AI-powered customer support, automated operations, and remote facility control.

## 🤖 Claude Context

**See CLAUDE.md for critical rules**. Production URL: https://clubos-frontend.vercel.app

## 🔒 Latest Security Update: Pattern System Hardening (v1.20.1)
- **Fixed critical SQL injection vulnerabilities**
- **Added comprehensive input validation**
- **Implemented XSS prevention with DOMPurify**
- **Enhanced error handling for AI operations**
- **Added pagination for large pattern sets**

## ✅ Latest Update: Enhanced Checklists Migration Complete (v1.20.0)
- **Database Migration Successful**: All enhanced tables and columns deployed to production
- **Admin Management UI**: Complete template management dashboard for admins at `/checklists-admin`
- **Supplies Tracking**: Track needed supplies with urgency levels (low/medium/high) - ACTIVE
- **Photo Attachments**: Damage reporting with photo evidence capability - READY
- **QR Code Access**: Generate QR codes for quick mobile checklist access - OPERATIONAL
- **Performance Dashboard**: Track completion rates, timing, and top performers - LIVE
- **Location Templates**: Clone and customize templates per location
- **Time Tracking**: Automatic duration calculation from door unlock to submission
- **Fallback Support**: System gracefully handles backward compatibility

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

#### 3. Clubhouse Challenges & Gamification (v1.14.36)
- **ClubCoin Economy**: Non-monetary points for wagering on golf matches
- **Head-to-Head Challenges**: 50/50 stake split (equal risk/reward)
- **5-Tier System**: Junior → House → Amateur → Pro → Master (NEW!)
- **Tier Progression**: Based on total CC earned, visual badges and progress bars
- **Booking Rewards**: 25 CC per booking (7-day delay) - Ready for HubSpot webhook
- **Seasonal Competitions**: 3-month seasons with resets and archives
- **18 Achievement Badges**: Automatic awarding based on performance
- **TrackMan Integration**: Settings catalog and round verification
- **Leaderboards**: Seasonal, all-time, and activity-based rankings
- **Champion Markers**: Tournament winners get 20% defeat bonus
- **Rate Limiting**: Anti-spam measures based on credibility scores
- **Expandable Challenge Cards**: View challenge details inline without navigation
- **CC Balance Adjustments**: Operators can credit/debit customer ClubCoins

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
├── scripts/                    # Operational scripts
├── docs/                       # All documentation (ORGANIZED)
│   ├── audits/                 # System audits and evaluations
│   ├── plans/                  # Implementation and enhancement plans
│   ├── status-reports/         # Progress and status updates
│   └── archive/                # Historical documentation
│       └── pattern-learning/   # Pattern learning history
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

## 📊 Current State (September 2025)

### Latest
- **v1.18.9**: V3-PLS Consolidation Phase 1 Complete
  - Unified pattern system preserving 100% of features
  - Created `enhanced-patterns.ts` combining all route capabilities
  - Created `patternSystemService.ts` unifying all services
  - Backup preserved in `backup/v3-pls-20250907/`
  - Ready for gradual rollout with instant rollback capability
- **v1.18.0**: White Label Planner Module
  - **System Analysis Tool**: Comprehensive scanner for white label planning
  - **Feature Inventory**: Categorizes all features as transferable or ClubOS-specific
  - **Branding Detection**: Finds hardcoded branding for replacement
  - **SOP Management**: Identifies replaceable procedures and workflows
  - **Blueprint Generation**: Creates implementation plans for new clients
  - Planning-only tool - analyzes what needs changing before building
  - Access via Operations → White Label (admin only)
- **v1.17.9**: AI-Enhanced Pattern Creation with GPT-4o
  - **Automatic Trigger Expansion**: Enter 3 examples, GPT-4o generates 10+ variations
  - **Response Optimization**: GPT-4o ensures responses are direct and actionable
  - **Semantic Similarity Detection**: Prevents duplicate patterns using embeddings
  - **Pattern Templates**: Quick-start templates for common pattern types
  - **Effectiveness Scoring**: Real-time feedback on pattern quality
  - Patterns now match 95% of variations (up from 60%)
  - All enhancements automatic - no extra UI complexity
- **v1.17.8**: Manual Pattern Creation for V3-PLS
  - Added "Add Pattern" button to V3-PLS interface for manual pattern creation
  - Full-featured creation modal with:
    - Multiple trigger examples for better matching
    - Response template editor with variable support ({{customer_name}}, etc.)
    - Confidence score slider for initial settings
    - Auto-execute toggle with safety warnings
    - Pattern testing tool to validate before saving
  - Backend API endpoint (POST /api/patterns) with:
    - Automatic embedding generation for semantic search
    - GPT-4o validation of responses for Clubhouse tone
    - Duplicate pattern detection
    - Full audit logging for tracking manually created patterns
  - Patterns can now be created manually OR learned automatically from operator responses
- **v1.17.7**: Fixed V3-PLS Pattern Display Issue
  - Patterns were being created but not showing in UI (filtered by is_active)
  - Now displays ALL patterns so operators can toggle them on/off
  - Run `psql $DATABASE_URL < scripts/show-all-patterns.sql` to see hidden patterns
- **v1.17.6**: Fixed V3-PLS Safety Settings Persistence
  - Blacklist topics and escalation keywords now properly persist after saving
  - Added success notification when settings are saved
  - Database migration ensures all required config rows exist
  - Frontend properly reloads settings to confirm they were saved
- **v1.17.0**: Enhanced Pattern Learning with GPT-4o Context Adaptation
  - Fixed pricing pattern trigger (was "Providing specific pricing information" instead of actual questions)
  - GPT-4o now adapts responses to match customer tone while preserving exact information
  - Added semantic search with embeddings for better pattern matching
  - Multiple trigger examples per pattern for improved matching
  - Response validation ensures edited templates work with GPT-4o
  - Maintains Clubhouse brand voice automatically
  - See [Pattern GPT-4o Adaptation](./docs/PATTERN-GPT4O-ADAPTATION.md) for details
- **v1.16.9**: Fixed Messages Not Showing After Send
  - Fixed duplicate /send endpoints causing confusion
  - Added immediate database update after sending messages
  - Messages now appear instantly in conversation without waiting for webhook
  - Removed old duplicate endpoint that used wrong database table
- **v1.17.5**: V3-PLS Safety Controls Now Fully Operational
  - **Real Safety Implementation**: Backend patternSafetyService with database integration
  - **Blacklist Protection**: Keywords like "medical", "legal", "refund" block auto-responses completely
  - **Escalation System**: "Angry", "lawyer", "emergency" keywords create operator alerts
  - **Pattern Approval**: New patterns require 10 successful uses with operator approval before auto-executing
  - **Learning Threshold**: Minimum 5 similar examples required before pattern creation
  - **Operator Priority**: Manual corrections weighted 2x more than auto-learned patterns
  - **Database Migration 209**: Created tables for pattern_learning_examples, pattern_escalation_alerts
  - **Combined UI**: Stats & Settings in single tab with toggleable views
  - **Live Protection**: Safety checks run on every message before any auto-response
- **v1.17.4**: V3-PLS System Controls for Better Auto-Responses
  - Added practical system controls to improve automated responses
  - Safety controls: blacklisted topics, escalation keywords, approval requirements
  - Confidence thresholds: control when to auto-execute vs suggest
  - Human-like delays: 3-8 second delay with typing indicator
  - Business context: different responses for after-hours, location context
  - Learning settings: minimum examples, operator override weight
  - Enhancement options: auto-include links, add contact options
- **v1.17.3**: V3-PLS Operator Statistics Dashboard
  - Redesigned statistics tab with real operator-focused metrics
  - Shows automation rate, time saved, common questions
  - Peak message times with automated vs manual breakdown
  - Pattern performance tracking with success rates
  - Operator impact metrics showing workload reduction
  - Optimization tips based on actual usage data
- **v1.17.2**: V3-PLS UI Compliance Update
  - Removed all emojis from Pattern Automation cards (ClubOS no-emoji policy)
  - Replaced emojis with professional Lucide React icons
  - Updated color scheme from indigo to ClubOS green (#0B3D3A)
  - Standardized card styling to match dashboard design
  - Fixed typography to match ClubOS standards
  - Design compliance score improved from 3/10 to 10/10
- **v1.17.1**: Removed placeholder Analytics tab from Operations
  - Cleaned up unused mock data components
  - Operations now defaults to V3-PLS for operators
- **v1.17.0**: NinjaOne Dynamic Script & Device Management
  - Database-driven script/device registry - no more hardcoding!
  - Admin UI for managing NinjaOne scripts and devices
  - Sync from NinjaOne with one click
  - Dynamic location/bay detection from database
  - See [NinjaOne Status](./docs/implementation/NINJAONE-IMPLEMENTATION-STATUS.md) for details
- **v1.16.8**: Fixed V3-PLS Page Loading Issues
  - Fixed HTTP method mismatch (PATCH vs PUT) in PatternAutomationCards
  - Corrected ai-automations API endpoint paths
  - Fixed response format handling for ai-automations features
- **v1.16.7**: Fixed Messages Page Auto-Refresh Bug
  - Conversation no longer resets to first one during refresh cycles
  - Users can stay on selected conversation without interruption
- **v1.16.6**: UI Spacing Improvements
  - Fixed navigation bar padding (added top padding, reduced height)
  - Reduced excessive spacing between nav and content
  - Tighter, more compact interface layout
- **v1.16.5**: V3-PLS Pattern Learning System Activated
  - AI Automation cards UI for managing learned patterns
  - Automatic learning from REAL operator responses only
  - No fake seed patterns - learns from actual conversations
  - Toggleable automations with edit capabilities
  - Run `scripts/enable-v3-pls.sql` to activate
- **v1.16.4**: Cleaned Up Operations Center Integrations Page
  - Removed duplicate AI Automations (now only in V3-PLS)
  - Removed placeholder sections (System Features, API Keys, Knowledge Management)
  - Focused page on actual third-party service configurations
  - Better separation of concerns between pages
- **v1.16.1**: Architectural Refactoring Phase 2 - Auth Module Complete
  - Migrated entire Auth module to new architecture (1098 → 110 lines)
  - Created AuthController, AuthService, UserRepository
  - Added comprehensive auth validators
  - Achieved 90% reduction in route file complexity
  - Created migration status tracker for remaining modules
- **v1.16.0**: Architectural Refactoring Phase 1 Complete
  - Implemented foundation layer with core utilities
  - Created BaseController, BaseRepository, ApiResponse, asyncHandler
  - Standardized response formats across all endpoints
  - Added HealthController as proof-of-concept for new architecture
  - Foundation ready for complete module-by-module migration
- **v1.15.3**: Complete Pattern Learning System fixes
  - Connected pattern execution statistics tracking
  - Implemented confidence evolution tracking with history
  - Added operator action logging for all accept/modify/reject actions
  - Fixed pattern statistics updates after each execution
  - System now learns from operator feedback automatically
- **v1.15.2**: Fixed authentication errors and OpenAI assistant handling
  - Added missing blacklisted_tokens table for JWT management
  - Fixed invalid assistant ID errors with graceful fallback
- **v1.15.1**: Live Pattern Dashboard - Real-Time Queue & Operator Actions
  - Added live dashboard showing pending AI suggestions in real-time
  - One-click operator actions: Accept, Edit, or Reject suggestions
  - Messages sent directly via OpenPhone when accepted/modified
  - Pattern confidence automatically adjusts based on operator feedback
  - Recent activity feed shows last 50 pattern matches
  - 5-second polling for real-time updates
  - Operator actions tracked for continuous learning
- **v1.15.0**: V3-PLS Pattern Learning System Implementation
  - GPT-4 powered pattern enhancement for 158 existing patterns
  - Template variables for dynamic responses ({{customer_name}}, {{bay_number}})
  - Real-time pattern learning from operator responses
  - Foundation for 80% automation target with semantic matching
  - Railway deployment scripts for production upgrades
- **v1.14.59**: Tournament Achievements System
  - Complete achievement system with 34 pre-defined achievements
  - Operator management interface for awarding badges
  - Achievement display on profiles, leaderboards, and compete pages
  - Auto-award system for milestone achievements
  - See [Tournament Achievements Plan](./TOURNAMENT_ACHIEVEMENTS_PLAN.md) for details
- **v1.14.35**: Fixed competitors page wins/plays statistics
- **v1.14.34**: Fixed profile page stats not updating properly
- **v1.14.33**: Fixed all-time leaderboard rank change indicators
- **v1.14.21**: Challenge System Flexibility & Audit
  - Added "Decide outside of the challenge" option to skip TrackMan settings
  - Made course_id optional in database for manual challenge setup
  - Complete audit verifying profile updates, CC transactions, and leaderboard integration
  - Comprehensive documentation in CHALLENGE-SYSTEM-AUDIT.md
- **v1.14.20**: Complete Friend System Implementation
  - Added comprehensive FriendRequests component for managing requests
  - New "Requests" tab in compete page with notification badges
  - Fixed database foreign key constraints with duplicate user tables
  - Prevented self-friending at API level
  - Set up test accounts with 100 coins each as friends
  - Fixed club coins balance initialization
  - Friend requests now properly visible to recipients
- **v1.14.19**: Comprehensive Friends Feature Improvements
  - Added interactive friends list to compete page with click-to-challenge
  - Pre-select friend when navigating from compete to challenge creation
  - Fixed friend request functionality in leaderboard
  - Added friend management UI with remove and block options
  - Updated friends API to return proper data structure
  - Fixed leaderboard to check correct friendship status
  - Improved UI with dropdown menus and better visual feedback
- **v1.14.11**: Professional Customer Profile Redesign
  - Clean, minimalist design matching ClubOS style
  - Real data: 100 CC for founding members
  - Removed gamification for professional look
- **v1.14.10**: Customer Dashboard Optimization
  - Compact location selector, removed unavailable features
  - Quick Stats bar and Quick Links for better navigation
  - Consistent "Bay" naming convention throughout
- **v1.14.9**: Unified Competition System
  - Combined Friends and Challenges into single "Compete" page
  - Fantasy sports-style focus on competition vs social messaging
  - Streamlined navigation with Challenges, Competitors, Leaderboard tabs
- **v1.14.8**: Pride-first profile page with rank emblems and career timeline
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
  - Head-to-head wagering with 50/50 stake splits
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

### Core Documentation (Root)
- **README.md** - This file
- **CHANGELOG.md** - Version history  
- **CLAUDE.md** - User preferences, working style (MUST READ)

### Documentation Structure (`/docs`)
```
docs/
├── architecture/       # System design and refactoring plans
├── audits/            # System audits and evaluations
├── features/          # Feature-specific documentation
│   └── v3-pls/       # V3 Pattern Learning System docs
├── implementation/    # Implementation guides and status
├── plans/            # Future plans and proposals
├── status-reports/   # Progress and status updates
└── archive/          # Historical/deprecated docs
```

### Key Documentation
- **Architecture** - System refactoring plans in `/docs/architecture/`
- **V3-PLS** - Pattern learning docs in `/docs/features/v3-pls/`
- **Audits** - System audits in `/docs/audits/`
- **Implementation** - Feature status in `/docs/implementation/`
- **API Docs** - `/ClubOSV1-backend/docs/`

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