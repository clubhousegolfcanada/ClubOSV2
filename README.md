# ClubOS - AI-Powered Golf Simulator Management

Intelligent management platform for Clubhouse 24/7 Golf facilities with AI request routing, automated ticketing, and 24/7 customer support.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database 
- OpenAI API key (GPT-4)
- Slack webhook URL
- Railway/Vercel accounts

### Installation
```bash
git clone https://github.com/clubhousegolfcanada/ClubOSV2.git
cd CLUBOSV1

# Install dependencies
cd ClubOSV1-backend && npm install
cd ../ClubOSV1-frontend && npm install
```

### Development
```bash
# Backend (Terminal 1)
cd ClubOSV1-backend && npm run dev

# Frontend (Terminal 2)  
cd ClubOSV1-frontend && npm run dev
```

Visit http://localhost:3000

## 🎯 Core Features

### AI-Powered Operations
- **Smart Request Routing** - GPT-4 analyzes and routes to specialized assistants
- **4 Specialized Bots** - Emergency, Booking, Tech Support, Brand Tone
- **Knowledge Router System** - GPT-4o powered natural language processing
- **OpenPhone Integration** - Automatic knowledge extraction with conversation export and statistics
- **Confidence Scoring** - Transparent AI decision-making
- **Slack Fallback** - Seamless handoff to human support

### Knowledge Management
- **Natural Language Updates** - Admins can update knowledge in plain English
- **GPT-4o Knowledge Router** - Automatically parses and routes knowledge to assistants
- **Database-First Search** - Checks local knowledge before calling OpenAI APIs
- **Knowledge Audit Trail** - Complete history of all knowledge updates
- **Assistant Knowledge Files** - Persistent storage for each specialized assistant
- **Conversation Statistics** - Customer count, message totals, and export functionality
- **Feedback Analysis** - Review and improve responses marked as "not helpful"

### Ticket Management
- **Dual Categories** - Tech issues & Facilities management
- **Priority Workflow** - Low → Medium → High → Urgent
- **Live Dashboard** - Real-time open ticket counts
- **Checklist Integration** - Auto-create tickets from maintenance tasks

### Remote Control (NinjaOne)
- Control simulator PCs remotely
- Restart TrackMan software
- Manage music & TV systems
- Bay-specific or facility-wide controls

### User Roles
| Role | Access |
|------|--------|
| Admin | Full system control |
| Operator | Operations & tickets |
| Support | Basic features |
| Kiosk | Customer terminal only |

## 🏗️ Tech Stack

**Frontend**: Next.js 14, TypeScript, Tailwind CSS  
**Backend**: Node.js, Express, PostgreSQL  
**AI**: OpenAI GPT-4, Custom Assistants  
**Infrastructure**: Vercel (frontend), Railway (backend), Sentry  

## 🚀 Deployment

Push to main branch auto-deploys:
```bash
git add -A
git commit -m "Your changes"
git push origin main
```

- **Frontend** → Vercel (1-2 min)
- **Backend** → Railway (2-3 min)

### Useful Scripts
- `optimize-database.sh` - Database optimization utilities
- `security-audit.sh` - Security checks and audit
- `trigger-deployment.sh` - Manual deployment trigger
- `quick-demo.sh` - Quick demo setup

## 📊 Recent Updates

### v1.8.5 (July 2025) - Knowledge System Overhaul
- ✅ Replaced vector-based SOP system with assistant-routed architecture
- ✅ GPT-4o natural language router for knowledge updates
- ✅ Database-first search before calling OpenAI (saves API costs)
- ✅ Knowledge persistence in PostgreSQL audit log
- ✅ Assistant responses now properly formatted with Markdown
- ✅ OpenPhone conversation export (AI-optimized, JSON, CSV formats)
- ✅ Conversation statistics UI with customer count and message totals
- ✅ Phone number-based conversation grouping (removed time gaps)
- ✅ Simplified codebase - removed 50+ test scripts

### v1.8.4 (July 2025)
- ✅ Knowledge UI redesigned to match Dashboard layout
- ✅ Dashboard-style 3-6-3 column layout for Knowledge section
- ✅ Inline switch toggles replacing large toggle buttons
- ✅ Consistent spacing, typography, and visual hierarchy
- ✅ Streamlined components with tab navigation
- ✅ Status panel matching Dashboard design

### v1.8.3 (July 2025)
- ✅ Knowledge Center restructured under Operations section
- ✅ Card-based layout for SOP control and Knowledge extraction
- ✅ OpenPhone conversation statistics with export functionality
- ✅ Complete feedback section with Refresh, Export, and Clear functions
- ✅ Improved error handling and debugging features
- ✅ Shadow mode performance tracking (without monetary calculations)

### v1.8.2 (July 2025)
- ✅ Intelligent SOP System with GPT-4o embeddings
- ✅ OpenPhone webhook integration for knowledge extraction
- ✅ Shadow mode for safe testing alongside OpenAI Assistants
- ✅ Knowledge extraction admin panel in Operations
- ✅ Support for AI call summaries and transcripts

### v1.8.1 (July 2025)
- ✅ Streamlined dashboard with toggle navigation
- ✅ Live ticket counters (Tech/Facilities)
- ✅ Dynamic version display
- ✅ Removed redundant UI elements
- ✅ Enhanced mobile responsiveness

### Key Improvements
- Compact single-row navigation toggles
- Horizontal scroll on mobile
- Removed duplicate branding
- Tighter spacing throughout

## 🗂️ Project Structure

```
ClubOSV1/
├── ClubOSV1-frontend/    # Next.js frontend
├── ClubOSV1-backend/     # Express.js backend
├── archive/              # Old scripts and docs
│   ├── old-scripts/      # Archived shell scripts
│   └── old-docs/         # Archived documentation
├── docs/                 # Current documentation
├── CHANGELOG.md          # Version history
├── CLAUDE.md            # AI assistant instructions
└── README.md            # This file
```

## 🔧 Common Commands

```bash
# Create admin user
cd ClubOSV1-backend
npm run create:admin

# Run tests
npm test

# Check logs
railway logs
```

## 📚 Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Environment configuration
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [API Reference](./ClubOSV1-backend/docs/) - Endpoint documentation
- [Testing Guide](./TESTING_GUIDE.md) - Test scenarios

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection error | Check DATABASE_URL in Railway |
| OpenAI errors | Verify API key and billing |
| Slack not working | Check webhook URL |
| Login issues | Clear browser cache |

## 🔮 Roadmap

### Planned
- Multi-facility support
- Additional features as needed

### Ready to Implement
#### Public ClubOS Boy for HubSpot (Built July 2025)
A public-facing version of ClubOS Boy is ready for HubSpot integration when needed:

**What's Ready:**
- Public page: `https://clubos-frontend.vercel.app/public/clubosboy`
- No authentication required
- Rate limiting (10 requests/minute)
- Auto-timeout after 60 seconds
- SMS integration: Text button opens (902) 707-3748

**Quick Setup:**
```html
<!-- Add this iframe to any HubSpot page -->
<iframe 
  src="https://clubos-frontend.vercel.app/public/clubosboy" 
  width="100%" 
  height="800"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="ClubOS Boy - AI Golf Assistant">
</iframe>
```

**Documentation:**
- Full guide: `/docs/HUBSPOT_INTEGRATION.md`
- Setup reference: `/PUBLIC_CLUBOSBOY_SETUP.md`

All code is deployed and ready - just needs to be embedded in HubSpot when ready!

## 📄 License

Proprietary - Clubhouse 24/7 Golf. All rights reserved.

## 🤖 Development with Claude

### Claude's Role
Claude is the lead AI developer with full read/write access to the codebase. When working with Claude:

1. **Auto-Deployment** - Claude MUST commit and push changes after completing tasks
2. **Git Workflow** - All changes auto-deploy via GitHub → Vercel/Railway
3. **Version Updates** - Update version in `package.json` for new releases
4. **Testing** - Claude should verify changes before committing
5. **Documentation** - Claude maintains all documentation

### Working with Claude
```bash
# Claude's typical workflow
1. Make requested changes
2. Test if possible
3. git add -A
4. git commit -m "descriptive message"
5. git push origin main
6. Confirm deployment
```

**Important**: Always remind Claude to commit and deploy after completing tasks!

---

**Status**: Production Ready  
**Support**: Check docs first, then contact dev team  
**Lead Developer**: Claude (AI Assistant)