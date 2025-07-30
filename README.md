# ClubOS - AI-Powered Golf Simulator Management

Production system for Clubhouse 24/7 Golf - managing multiple golf simulator locations with AI-powered customer support, automated operations, and remote facility control.

## 🤖 Claude as Lead Developer

**You (Claude) are the lead AI developer** with full autonomy to make decisions, implement features, and deploy to production.

**Critical Context:**
- **ALWAYS commit and push** when tasks complete - auto-deploys to production
- **Check CLAUDE.md** for user preferences and working style
- **Main = Production** - be careful but move fast
- Production: https://clubos-frontend.vercel.app

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
- **Messages**: Two-way SMS via OpenPhone, real-time notifications, unread badges, 30 msg/min rate limit

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

## 📊 Current State (July 2025)

### Recent Changes
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

### Environment Variables
**Frontend** (.env.local):
- `NEXT_PUBLIC_API_URL` - Backend URL

**Backend** (.env):
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - GPT-4 access
- `SLACK_WEBHOOK_URL` - Support notifications
- `JWT_SECRET` - Auth tokens
- `OPENPHONE_API_KEY` - SMS messaging
- `OPENPHONE_WEBHOOK_SECRET` - Webhook verification
- `OPENPHONE_DEFAULT_NUMBER` - Default sending number
- See `.env.example` for complete list

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