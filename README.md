# ClubOS V1 - Intelligent Golf Simulator Management System

A comprehensive AI-powered management platform for Clubhouse 24/7 Golf facilities, featuring intelligent request routing, automated ticket management, and customer self-service capabilities.

## 🎯 Overview

ClubOS transforms golf simulator facility operations with:
- **AI-Powered Request Processing**: Routes customer inquiries to specialized GPT assistants
- **Smart Ticket Management**: Track and resolve facility & technical issues efficiently  
- **Customer Kiosk Interface**: Self-service portal for 24/7 customer support
- **Real-time Slack Integration**: Seamless handoff between AI and human support
- **Performance Analytics**: Track response quality and operational metrics

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (Railway provides this)
- OpenAI API account with GPT-4 access
- Slack workspace with webhook access
- Railway account for deployment

### Installation

```bash
# Clone repository
git clone [repository-url]
cd CLUBOSV1

# Install all dependencies
cd ClubOSV1-backend && npm install
cd ../ClubOSV1-frontend && npm install
```

### Environment Setup

Create `.env` files based on the templates in [SETUP_GUIDE.md](./SETUP_GUIDE.md).

### Running Locally

```bash
# Terminal 1 - Backend
cd ClubOSV1-backend
npm run dev

# Terminal 2 - Frontend  
cd ClubOSV1-frontend
npm run dev
```

Visit http://localhost:3000

## 🏗️ System Architecture

### Technology Stack

**Frontend**
- Next.js 13+ with TypeScript
- Tailwind CSS for styling
- Zustand for state management
- React Hook Form for forms
- Axios for API communication

**Backend**
- Node.js + Express + TypeScript
- PostgreSQL database
- JWT authentication
- OpenAI GPT-4 integration
- Slack webhook integration

**Infrastructure**
- Railway for hosting
- PostgreSQL on Railway
- GitHub CI/CD integration
- Sentry for error tracking
- Vercel for frontend hosting

### AI Assistant Architecture

The system uses specialized GPT assistants for different request types:

```
User Request → LLM Router → Specialized Assistant → Structured Response
                    ↓
              Confidence Score
                    ↓
            Route Selection:
            • Emergency (urgent issues)
            • Booking & Access (reservations)
            • Tech Support (equipment)
            • Brand Tone (general info)
```

## 🎨 Key Features

### 1. Intelligent Request Routing
- **Auto-routing**: AI analyzes requests and selects appropriate department
- **Manual Override**: Force specific route when needed
- **Confidence Scoring**: Transparency in AI decision-making
- **Fallback Logic**: Graceful degradation to Slack when AI unavailable

### 2. Multi-Mode Operation
- **Smart Assist ON**: Full AI processing with specialized assistants
- **Smart Assist OFF**: Direct routing to Slack support team
- **Ticket Mode**: Create trackable tickets for complex issues
- **Kiosk Mode**: Simplified interface for customer terminals

### 3. Advanced Ticket System
- Categories: Facilities & Technical Support
- Priority Levels: Low → Medium → High → Urgent
- Status Workflow: Open → In Progress → Resolved → Closed
- Collaborative comments and updates
- Bulk operations for administrators
- Automatic ticket creation from checklists
- Integration with checklist submissions

### 4. User & Access Management
| Role | Description | Access Level |
|------|-------------|--------------|
| Admin | System administrators | Full access to all features |
| Operator | Facility operators | Tickets, operations, all routing |
| Support | Support staff | Basic features, limited routing |
| Kiosk | Customer terminals | ClubOS Boy interface only |

### 5. Operations Dashboard
- User management with CRUD operations
- System configuration controls
- Feedback analytics and export
- Slack notification preferences
- Database backup/restore
- Checklist completion tracking

### 6. Comprehensive Checklist System
- Daily, weekly, and quarterly checklists
- Cleaning and technical maintenance categories
- Location-based task management
- Progress tracking with visual indicators
- Comment field for notes and issues
- Automatic ticket creation from checklists
- Submission history with filters
- Delete functionality (admin/operator)
- Integration with ticket system

### 7. NinjaOne Remote Actions
- Remote control of simulator PCs
- TrackMan software restart
- Music system control
- TV system management
- Bay-specific and system-wide controls
- Real-time job status tracking
- Action history logging
- Demo mode for testing

### 8. Customer Feedback Loop
- Rate AI responses as helpful/not helpful
- Track patterns in unsuccessful interactions
- Export data for AI model improvement
- Automatic Slack alerts for poor responses

### 9. Enhanced Slack Integration
- Outbound message notifications
- Thread tracking for conversations
- Reply monitoring and database storage
- Custom webhook integrations
- Channel-specific routing (#tech-alerts, #tech-actions-log)

## 📁 Project Structure (Clean & Organized)

```
CLUBOSV1/
├── README.md                    # This file
├── SETUP_GUIDE.md              # Detailed setup instructions
├── DEPLOYMENT.md               # Production deployment guide
├── TESTING_GUIDE.md            # Comprehensive testing documentation
├── DEVELOPMENT_GUIDE.md        # Developer guidelines
├── CHANGELOG.md                # Version history
├── DOCUMENTATION_VERIFICATION.md # Doc verification checklist
│
├── ClubOSV1-frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── pages/              # Page components
│   │   ├── components/         # Reusable components
│   │   ├── api/               # API client
│   │   ├── state/             # Global state management
│   │   ├── hooks/             # Custom React hooks
│   │   └── types/             # TypeScript definitions
│   └── public/                # Static assets
│
├── ClubOSV1-backend/           # Express backend API
│   ├── src/
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   ├── utils/            # Utility functions
│   │   ├── database/         # Database migrations
│   │   └── scripts/          # Admin tools
│   └── logs/                 # Application logs
│
├── ClubOS Agents/             # OpenAI Assistant configurations
│   ├── Booking & AccessBot/   # Booking assistant docs
│   ├── EmergencyBot/          # Emergency assistant docs
│   ├── TechSupportBot/        # Tech support assistant docs
│   └── BrandTone & MarketingBot/ # Brand assistant docs
│
├── docs/                      # Technical documentation
│   ├── slack/                 # Slack integration docs
│   ├── clubos_structure.txt   # System architecture
│   └── ...                    # Other technical docs
│
├── scripts/                   # Utility scripts
│   ├── auth/                 # Authentication scripts
│   ├── backup/               # Backup scripts
│   ├── deployment/           # Deployment scripts
│   ├── tests/                # Test scripts
│   └── utilities/            # General utilities
│
├── assistant-instructions/    # GPT assistant templates
│   ├── *.md                  # Assistant instruction docs
│   └── assistant-*.json      # Assistant configurations
│
├── test-html/                # HTML test files
│   └── *.html               # Test pages
│
├── archive/                  # Archived/old files
│   ├── old-fixes/           # Old fix scripts
│   ├── old-postgresql-migrations/ # Old SQL migrations
│   ├── old-deployment-scripts/ # Old deploy scripts
│   ├── completed-features/   # Completed feature docs
│   └── test-scripts/        # Old test scripts
│
├── Notes/                   # Development notes
├── .gitignore              # Git ignore rules (updated)
├── package.json            # Root package file
└── tsconfig.json           # TypeScript config
```

## 🔐 Security Features

- **Authentication**: JWT tokens with 24-hour expiration
- **Password Policy**: Minimum 8 characters with complexity requirements
- **Role-Based Access Control**: Granular permissions per user type
- **Rate Limiting**: Multi-tier API protection
  - General: 100 req/15min (production)
  - Auth: 5 attempts/15min
  - LLM: 10 req/min
- **Input Validation**: Comprehensive sanitization and XSS prevention
- **CORS Protection**: Configured for production domains
- **Webhook Verification**: Slack signature validation
- **Error Tracking**: Sentry integration for real-time monitoring


## 🛠️ Development

### Essential Commands

```bash
# Backend Development
cd ClubOSV1-backend
npm run dev          # Start with hot reload
npm run build        # Production build
npm run test         # Run test suite
npm run lint         # Code quality check

# Frontend Development
cd ClubOSV1-frontend
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Code quality check

# Admin Tasks
cd ClubOSV1-backend
npm run create:admin  # Create admin user
npm run create:kiosk  # Create kiosk user
node scripts/createAdmin.ts  # Manual admin creation
```

### API Documentation

See [API Reference](./ClubOSV1-backend/docs/API_USAGE_TRACKING.md) for complete endpoint documentation.

Key endpoints:
- `POST /api/llm/request` - Process request with AI
- `POST /api/tickets` - Create support ticket
- `POST /api/feedback` - Submit response feedback
- `POST /api/customer/ask` - Customer kiosk endpoint

## 🚀 Deployment

### Deployment Architecture
- **Frontend**: Hosted on Vercel (auto-deploys from GitHub)
- **Backend**: Hosted on Railway (auto-deploys from GitHub)
- **Database**: PostgreSQL on Railway
- **Version Control**: GitHub (main branch)

### Deployment Workflow

1. **Development & Testing**
   ```bash
   # Make changes locally
   # Test thoroughly
   # Commit changes
   git add -A
   git commit -m "Your commit message"
   ```

2. **Deploy to Production**
   ```bash
   # Push to GitHub - this triggers automatic deployments
   git push origin main
   ```

3. **Automatic Deployments**
   - **GitHub** → **Vercel**: Frontend auto-deploys (usually within 1-2 minutes)
   - **GitHub** → **Railway**: Backend auto-deploys (usually within 2-3 minutes)
   - Both platforms monitor the main branch for changes

4. **Post-Deployment Verification**
   - Check Vercel dashboard for frontend deployment status
   - Check Railway dashboard for backend deployment status
   - Test the live application
   - Monitor logs for any errors

### Manual Deployment (if needed)

**Backend (Railway CLI)**
```bash
cd ClubOSV1-backend
railway up
```

**Frontend (Vercel CLI)**
```bash
cd ClubOSV1-frontend
vercel --prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed configuration and troubleshooting.

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Unit tests
cd ClubOSV1-backend && npm test

# Integration tests  
npm run test:integration

# Manual testing
See TESTING_GUIDE.md for test scenarios
```

## 📊 System Status

### Current Implementation Status

✅ **Completed Features**
- PostgreSQL database integration
- User authentication & RBAC
- LLM routing with GPT-4
- Specialized GPT Assistants (all configured)
- Ticket management system
- Customer feedback tracking
- Slack outbound notifications
- System configuration UI
- ClubOS Boy kiosk mode
- NinjaOne remote actions integration
- Comprehensive checklist system
- Sentry error tracking
- Enhanced rate limiting

✅ **Recently Completed (July 2025)**
- Checklist comment system ✅
- Automatic ticket creation from checklists ✅
- Delete functionality for submissions ✅
- Current week/month filtering ✅
- React hydration fixes ✅
- TypeScript compilation fixes ✅

⚠️ **In Progress**
- Advanced analytics dashboard

❌ **Planned Features**
- Advanced reporting
- WebSocket support

### Recent Updates (July 2025)
1. ✅ **Enhanced Checklist System** - Comments, automatic ticket creation, delete functionality
2. ✅ **NinjaOne Integration** - Remote control of simulators, TrackMan, music, and TV systems
3. ✅ **System stability improvements** - Sentry error tracking, graceful shutdown, enhanced rate limiting
4. ✅ **Commands page redesigned** - Modern UI with Remote Actions for facility control
5. ✅ **Slack integration enhanced** - Thread tracking, reply monitoring, channel routing
6. ✅ **Performance optimizations** - Database indexes, connection pooling, React hydration fixes

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Verify DATABASE_URL in Railway environment |
| "OpenAI API error" | Check API key validity and billing status |
| "Slack messages not sending" | Verify webhook URL and channel permissions |
| "GPT assistants not responding" | Check Railway logs for specific errors |
| "Authentication failed" | Clear browser cache and localStorage |

## 📚 Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Detailed setup instructions
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment
- [Testing Guide](./TESTING_GUIDE.md) - Comprehensive testing
- [Development Guide](./DEVELOPMENT_GUIDE.md) - Developer guidelines
- [Slack Integration](./docs/SLACK_INTEGRATION.md) - Slack setup
- [Technical Debt](./docs/TECHNICAL_DEBT.md) - Known issues
- [API Documentation](./ClubOSV1-backend/docs/) - API reference

## 🎮 Usage Examples

### Staff Member Flow
1. Login with credentials
2. Enter customer request
3. System routes to appropriate assistant
4. Review AI response
5. Convert to ticket if needed
6. Rate response quality

### Customer Kiosk Flow
1. Access /clubosboy (no login)
2. Type question
3. Add bay location
4. Submit → Routes to Slack
5. Staff responds via Slack

### Emergency Handling
1. System detects emergency keywords
2. Routes to Emergency assistant
3. Provides immediate response
4. Creates urgent ticket
5. Notifies staff via Slack

## 🔮 Roadmap

### Q4 2024
- [ ] Complete Slack reply tracking
- [ ] Implement WebSocket notifications
- [ ] Mobile UI improvements

### Q1 2025
- [ ] Advanced analytics dashboard
- [ ] Email notification system
- [ ] API v2 with GraphQL

### Future
- [ ] Mobile applications
- [ ] Voice assistant integration
- [ ] Multi-facility support
- [ ] AI model fine-tuning

## 👥 Support

For technical support or questions:
- Check documentation first
- Review [TESTING_GUIDE.md](./TESTING_GUIDE.md) for common issues
- Contact development team for access

## 📄 License

Proprietary software - All rights reserved by Clubhouse 24/7 Golf

---

**Version**: 1.8.1  
**Last Updated**: July 28, 2025  
**Status**: Production Ready  
**Lead Developer**: Claude (AI) - Full read/write capabilities  
