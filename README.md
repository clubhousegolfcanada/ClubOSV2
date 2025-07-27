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

### 6. Customer Feedback Loop
- Rate AI responses as helpful/not helpful
- Track patterns in unsuccessful interactions
- Export data for AI model improvement
- Automatic Slack alerts for poor responses

## 📁 Project Structure

```
CLUBOSV1/
├── README.md                    # This file
├── SETUP_GUIDE.md              # Detailed setup instructions
├── DEPLOYMENT.md               # Production deployment guide
├── TESTING_GUIDE.md            # Comprehensive testing documentation
├── DEVELOPMENT_GUIDE.md        # Developer guidelines
├── CHANGELOG.md                # Version history
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
├── docs/                      # Additional documentation
├── assistant-instructions/    # GPT assistant templates
└── archive/                  # Historical documentation
```

## 🔐 Security Features

- **Authentication**: JWT tokens with 24-hour expiration
- **Password Policy**: Minimum 8 characters with complexity requirements
- **Role-Based Access Control**: Granular permissions per user type
- **Rate Limiting**: API protection against abuse (100 req/15min) - *Currently disabled for demo*
- **Input Validation**: Comprehensive sanitization and validation
- **CORS Protection**: Configured for production domains
- **Webhook Verification**: Slack signature validation

## 🎮 Demo Mode

The system is currently configured in demo mode for testing purposes:

- **Authentication**: Main LLM endpoint (`/api/llm/request`) has authentication disabled
- **Rate Limiting**: Temporarily disabled on LLM endpoints due to Railway proxy issues
- **Default Admin**: Auto-created on startup (admin@clubhouse247golf.com / admin123)
- **Test without OpenAI**: System includes fallback routing when API keys unavailable

**Note**: For production deployment, re-enable authentication and rate limiting by uncommenting the middleware in `/routes/llm.ts`.

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

### Production Deployment (Railway)

1. **Prerequisites**
   - Railway account with PostgreSQL add-on
   - All environment variables configured
   - GPT Assistant IDs configured in Railway ✅

2. **Deploy Backend**
   ```bash
   cd ClubOSV1-backend
   railway up
   ```

3. **Deploy Frontend**
   - Push to GitHub
   - Railway auto-deploys from main branch

4. **Post-Deployment**
   - Create initial admin user
   - Configure system settings
   - Test all integrations

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

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

⚠️ **In Progress**
- Slack reply tracking (Phase 2)
- Real-time notifications
- Advanced analytics dashboard

❌ **Planned Features**
- Email notifications
- Mobile application
- Multi-language support
- Advanced reporting
- WebSocket support

### Known Issues
1. Slack replies require Events API setup (Phase 2)
2. Mobile UI needs responsive improvements
3. Some TypeScript build warnings (non-critical)

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

**Version**: 1.0.0  
**Last Updated**: November 2024  
**Status**: Production Ready with Active Development

Built with ❤️ for the future of golf facility management