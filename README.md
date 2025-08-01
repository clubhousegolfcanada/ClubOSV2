# ClubOS - AI-Powered Golf Simulator Management

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
- **Slack Fallback**: Human handoff when AI confidence low

#### 2. Operations Management
- **Tickets**: Tech/Facilities categories, priority workflow, Slack integration
- **Checklists**: Daily maintenance, auto-ticket creation, admin-only task editing
- **Remote Control**: NinjaOne integration for simulator/TV/music control
- **Analytics**: Usage tracking, performance metrics, cost monitoring
- **Messages**: 
  - Two-way SMS via OpenPhone with AI suggestions
  - Real-time notifications, unread badges
  - International phone number support
  - Rate limiting: 30 msg/min, 10 API calls/sec
  - Push notifications for new messages (works in background)
- **Call Transcripts**: Extract knowledge from customer calls, searchable archive

#### 3. User System
| Role | Access | Key Features |
|------|--------|--------------|
| Admin | Full system | Knowledge management, all operations |
| Operator | Operations | Tickets, checklists, basic analytics |
| Support | Limited | Commands, ClubOS Boy, no sensitive ops |
| Kiosk | Public only | ClubOS Boy terminal interface |

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
├── docs/                       # Documentation
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
railway logs            # Check production logs

# Check deployment status
# Frontend: https://vercel.com/dashboard
# Backend: https://railway.app/dashboard
```

## 📊 Current State (August 2025)

### Recent Changes
- **v1.10.1**: PWA Support Phase 1 - Icons and manifest
  - Full Android PWA compliance with valid icons
  - Web app manifest configured for installability
  - Middleware updated for public file access
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
1. Create numbered migration: `/backend/src/database/migrations/016_feature.sql`
2. Migrations run automatically on deploy
3. Update TypeScript types if needed

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

- **CLAUDE.md** - User preferences, working style (MUST READ)
- **CHANGELOG.md** - Version history
- **PUBLIC_CLUBOSBOY_SETUP.md** - Public embed instructions
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