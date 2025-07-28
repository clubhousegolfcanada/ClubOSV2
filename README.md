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
- **Intelligent SOP System** - Local knowledge base with embeddings (saves $750/month)
- **OpenPhone Integration** - Automatic knowledge extraction from customer calls
- **Confidence Scoring** - Transparent AI decision-making
- **Slack Fallback** - Seamless handoff to human support

### Knowledge Management
- **SOP Module Control** - Toggle between OpenAI Assistants and local SOP system
- **Shadow Mode** - Run both systems in parallel for performance comparison
- **Knowledge Extraction** - Process OpenPhone conversations into actionable knowledge
- **Recent Messages** - Live view of customer interactions with auto-refresh
- **Feedback Analysis** - Review and improve responses marked as "not helpful"
- **Bulk Import** - Import documents (.docx, .md, .json) with AI categorization

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

## 📊 Recent Updates

### v1.8.3 (July 2025)
- ✅ Knowledge Center restructured under Operations section
- ✅ Card-based layout for SOP control and Knowledge extraction
- ✅ Live Recent Messages with 8-second auto-refresh
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