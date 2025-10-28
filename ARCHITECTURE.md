# ClubOS System Architecture

## 📊 System Overview

ClubOS is a production facility management system for Clubhouse 24/7, managing golf simulators, pickleball courts, and gym facilities across 6 locations with 10,000+ customers.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACES                            │
├──────────────┬──────────────┬──────────────┬───────────────────────┤
│   Customer   │   Operator   │    Admin     │    Kiosk/Public       │
│    Portal    │  Dashboard   │    Panel     │   (ClubOS Boy)        │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬────────────────┘
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                              │
                    ┌─────────▼─────────┐
                    │                   │
                    │    FRONTEND       │
                    │   (Next.js 15)    │
                    │    Port: 3001     │
                    │   Vercel Deploy   │
                    │                   │
                    └─────────┬─────────┘
                              │ HTTPS/REST API
                    ┌─────────▼─────────┐
                    │                   │
                    │     BACKEND       │
                    │    (Express)      │
                    │    Port: 3000     │
                    │  Railway Deploy   │
                    │                   │
                    └────┬────┬────┬────┘
                         │    │    │
        ┌────────────────┼────┼────┼────────────────┐
        │                │    │    │                │
   ┌────▼────┐    ┌─────▼──┐ │ ┌──▼─────┐   ┌─────▼─────┐
   │Database │    │ Redis  │ │ │   AI   │   │External   │
   │(Postgres)│    │ Cache  │ │ │(OpenAI)│   │Services   │
   │ Railway │    │Railway │ │ │ GPT-4  │   │           │
   └─────────┘    └────────┘ │ └────────┘   └───────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Pattern Learning │
                    │   System (V3-PLS)  │
                    │  95% Accuracy      │
                    └───────────────────┘
```

## 🏗️ Tech Stack

### Frontend (Port 3001)
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context + Local Storage
- **Deployment**: Vercel (auto-deploy on push)
- **Key Libraries**:
  - React Query (data fetching)
  - React Hook Form (forms)
  - Framer Motion (animations)
  - Chart.js (analytics)

### Backend (Port 3000)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 14
- **Cache**: Redis
- **Deployment**: Railway (auto-deploy on push)
- **Key Libraries**:
  - Sequelize (ORM)
  - Winston (logging)
  - Joi (validation)
  - Passport (auth)
  - Bull (job queues)

### Infrastructure
- **Database**: PostgreSQL on Railway
- **Cache**: Redis on Railway
- **File Storage**: Local filesystem + backups
- **Monitoring**: Sentry
- **CI/CD**: GitHub Actions
- **DNS/CDN**: Cloudflare

## 📁 Directory Structure

```
CLUBOSV1/
├── ClubOSV1-frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/             # Next.js pages
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/             # Utility functions
│   │   ├── api/               # API client functions
│   │   └── styles/            # Global styles
│   └── public/                # Static assets
│
├── ClubOSV1-backend/          # Express backend application
│   ├── src/
│   │   ├── routes/            # API endpoints (97 files)
│   │   ├── services/          # Business logic (75 files)
│   │   ├── middleware/        # Express middleware
│   │   ├── models/            # Database models
│   │   ├── utils/             # Utility functions
│   │   ├── database/
│   │   │   └── migrations/    # SQL migrations (166 files)
│   │   └── index.ts           # Main server file
│   └── scripts/               # Utility scripts
│
├── docs/                      # Documentation
├── scripts/                   # Deployment & maintenance scripts
└── config/                    # Configuration files
```

## 🔑 Core Systems

### 1. Authentication & Authorization
- **JWT-based** authentication with refresh tokens
- **Role-based** access control (Admin, Operator, Customer, Contractor, Kiosk)
- **Session management** with configurable timeouts
- **OAuth integration** with Google
- **Keep me logged in** functionality with secure token storage

### 2. Pattern Learning System (V3-PLS)
```
Customer Message → Pattern Matcher → Confidence Check → Action
                          ↑                    ↓
                     Pattern DB          Auto/Suggest/Queue
                          ↑                    ↓
                    Learn from          Operator Review
                      Response
```

- **95% accuracy** for common queries
- **Auto-learns** from operator responses
- **Confidence thresholds** for automation
- **Shadow mode** for safe testing
- **Pattern decay** for outdated responses

### 3. Booking System
- **Real-time availability** checking
- **Tier-based pricing** (Member, VIP, Corporate)
- **Advance booking limits** by customer tier
- **Conflict detection** and prevention
- **Email/SMS notifications** for confirmations
- **Admin blocking** for maintenance
- **Recurring bookings** support

### 4. Messaging & Communications
- **OpenPhone integration** for SMS
- **Two-way messaging** with customers
- **AI-powered responses** with operator approval
- **Message threading** and history
- **Push notifications** support
- **Slack integration** for team alerts

### 5. Remote Facility Control
- **NinjaOne RMM** for computer management
- **UniFi Access** for door control
- **Wake-on-LAN** for simulator PCs
- **Cloudflare Tunnels** for secure remote access
- **Emergency overrides** for all systems

### 6. Customer Features
- **ClubCoin economy** - Virtual currency system
- **Challenges** - Head-to-head wagering
- **Leaderboards** - Seasonal competitions
- **Achievements** - Gamification elements
- **TrackMan integration** - Golf shot data

## 🔄 Data Flow

### Typical Request Flow
1. **Customer Action** → Frontend (React)
2. **API Call** → Backend route handler
3. **Auth Check** → JWT validation
4. **Business Logic** → Service layer
5. **Data Access** → Database/Cache
6. **External Services** → If needed (AI, SMS, etc.)
7. **Response** → Back through chain
8. **UI Update** → React re-render

### Real-time Updates
- **Polling Strategy**:
  - Messages: Every 10 seconds
  - Tickets: Every 30 seconds
  - Notifications: Every 60 seconds
- **Future**: WebSocket implementation planned

## 🗃️ Database Schema

### Key Tables
- **users** - System users (employees, customers)
- **customers** - Customer profiles and tiers
- **bookings** - Facility bookings
- **tickets** - Support/maintenance tickets
- **messages** - SMS/chat messages
- **patterns** - V3-PLS learned patterns
- **knowledge_store** - Searchable knowledge base
- **challenges** - Head-to-head competitions
- **transactions** - ClubCoin transactions

### Migration Strategy
- **Sequential numbering** (001-166+)
- **Forward-only** migrations
- **Test locally** before production
- **Auto-run** on deployment

## 🔌 External Integrations

| Service | Purpose | Authentication |
|---------|---------|----------------|
| OpenAI GPT-4 | AI responses, pattern matching | API Key |
| OpenPhone | SMS messaging | API Key + Webhook |
| Slack | Team notifications | Webhook URL |
| HubSpot | CRM integration | Private App Key |
| NinjaOne | RMM for computers | OAuth 2.0 |
| UniFi Access | Door control | Local API |
| Stripe | Payment processing | Secret Key |
| TrackMan | Golf simulator data | API Key |
| Skedda | Legacy booking system | iframe |
| Google OAuth | Social login | Client ID/Secret |

## 🚀 Deployment Pipeline

### Development
```bash
# Frontend
cd ClubOSV1-frontend && npm run dev  # http://localhost:3001

# Backend
cd ClubOSV1-backend && npm run dev   # http://localhost:3000
```

### Production Deployment
```bash
git add -A
git commit -m "fix: description (v1.24.32)"
git push  # Triggers auto-deploy
```

### Auto-Deploy Process
1. **Push to main** branch
2. **GitHub Actions** runs tests
3. **Vercel** deploys frontend
4. **Railway** deploys backend
5. **Migrations** run automatically
6. **Health checks** verify deployment

## 🔒 Security Measures

- **Input validation** on all endpoints
- **SQL injection prevention** via parameterized queries
- **XSS protection** with content sanitization
- **CSRF tokens** for state-changing operations
- **Rate limiting** per endpoint
- **Encrypted sensitive data** (AES-256-GCM)
- **Security headers** (HSTS, CSP, X-Frame-Options)
- **API key rotation** capability
- **Audit logging** for sensitive operations

## 📊 Performance Optimizations

- **Redis caching** for frequent queries
- **Database indexes** on lookup fields
- **Lazy loading** for React components
- **Image optimization** with Next.js
- **API response compression**
- **Connection pooling** for database
- **Query optimization** with EXPLAIN
- **Bundle splitting** for frontend

## 🔧 Development Tools

- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for formatting
- **Jest** for testing
- **GitHub Actions** for CI/CD
- **Sentry** for error tracking
- **Winston** for logging
- **nodemon** for hot reload

## 📈 Monitoring & Observability

- **Sentry** - Error tracking and performance
- **Railway Metrics** - Server resources
- **Vercel Analytics** - Frontend performance
- **Custom Logging** - Winston with levels
- **Health Checks** - /health endpoint
- **Database Monitoring** - Slow query logs

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Errors | Token expired | Refresh token or re-login |
| Slow Queries | Missing indexes | Add database indexes |
| High Memory | Memory leaks | Check for unclosed connections |
| Deploy Fails | Migration errors | Test migrations locally first |
| SMS Not Sending | OpenPhone webhook | Check webhook configuration |

## 🔮 Future Improvements

### Planned
- WebSocket for real-time updates
- Microservices architecture
- GraphQL API layer
- React Native mobile app
- Advanced analytics dashboard

### In Consideration
- Kubernetes deployment
- Event sourcing for audit
- Machine learning for patterns
- Voice assistant integration
- Blockchain for ClubCoin

## 📚 Related Documentation

- [README.md](./README.md) - Quick start guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development standards
- [CHANGELOG.md](./CHANGELOG.md) - Version history
- [CLAUDE.md](./CLAUDE.md) - AI assistant context
- [docs/](./docs/) - Detailed documentation

## 🎯 Key Design Decisions

1. **Monorepo Structure** - Easier deployment and version sync
2. **TypeScript Everything** - Type safety across stack
3. **Railway + Vercel** - Simple, reliable deployment
4. **Pattern Learning** - Reduces operator workload
5. **Mobile-First** - All features work on phones
6. **Real-time Polling** - Simpler than WebSockets for now
7. **JWT Auth** - Stateless, scalable authentication
8. **PostgreSQL** - Reliable, ACID compliance
9. **Redis Cache** - Fast response times
10. **Auto-Deploy** - Ship fast, fix fast

---

*This architecture document provides a high-level overview. For detailed implementation specifics, consult the individual service and component documentation.*