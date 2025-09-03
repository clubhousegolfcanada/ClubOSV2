# ClubOS V1 - Complete System Documentation

## Executive Summary

ClubOS V1 is a comprehensive AI-powered golf simulator management platform designed for multi-location facilities. The system combines advanced AI automation, gamification, and operational management into a unified platform serving both customers and operators.

**Key Statistics:**
- **Technology Stack**: Full TypeScript (Next.js + Express.js + PostgreSQL)
- **AI Integration**: GPT-4 with 4 specialized assistants + pattern learning
- **Database**: 50+ tables with comprehensive migration system
- **API Surface**: 45+ RESTful endpoints
- **Integrations**: 15+ third-party services
- **Deployment**: Production-ready on Vercel/Railway

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  Next.js 15 | React 19 | Tailwind CSS | Zustand | PWA      │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│    Express.js | JWT Auth | Rate Limiting | Validation       │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  AI Services | Business Logic | Integrations | Caching      │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│     PostgreSQL | Redis Cache | Migration System             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

#### Frontend
- **Framework**: Next.js 15.4.5 with Pages Router
- **UI Library**: React 19.1.1 with TypeScript 5.3.3
- **State Management**: Zustand 4.4.7
- **Styling**: Tailwind CSS 3.4.0
- **Mobile**: Capacitor for iOS/Android
- **Monitoring**: Sentry 9.42.0

#### Backend
- **Runtime**: Node.js 18+ with Express.js 4.18.2
- **Language**: TypeScript 5.8.3
- **Database**: PostgreSQL with Sequelize ORM
- **Caching**: Redis via ioredis
- **Authentication**: JWT with bcrypt
- **API Documentation**: Express-validator

#### Infrastructure
- **Frontend Hosting**: Vercel
- **Backend Hosting**: Railway
- **Database**: Railway PostgreSQL
- **CDN**: Vercel Edge Network
- **Monitoring**: Sentry + Custom logging

## Core Features

### 1. Customer Features

#### Mobile App Experience
- **Dashboard**: Personalized stats, achievements, upcoming bookings
- **Booking System**: Bay reservations with HubSpot integration
- **Social Features**: Friend system, challenges, leaderboards
- **Gamification**: 
  - ClubCoin economy (CC)
  - Tier system (Bronze → Legend)
  - Achievements & badges
  - Box opening mechanics
  - Seasonal tournaments

#### Customer Profiles
- Display names and avatars
- Performance statistics
- Friend connections
- Achievement showcase
- Booking history
- ClubCoin balance

### 2. Operator Dashboard

#### Real-time Monitoring
- Live occupancy maps
- Customer message stream
- System status indicators
- Performance metrics
- Alert notifications

#### Management Tools
- Customer management
- Booking oversight
- Challenge moderation
- ClubCoin adjustments
- System configuration
- Backup management

### 3. AI/ML System

#### GPT-4 Integration
**Specialized Assistants:**
1. **Booking Assistant**: Handles reservations, access issues
2. **Emergency Assistant**: Safety protocols, urgent situations
3. **Tech Support Assistant**: TrackMan, simulator issues
4. **Brand Assistant**: Marketing, tone consistency

**AI Routing System:**
- Automatic intent detection
- Context-aware routing
- Fallback mechanisms
- Response caching

#### Pattern Learning System (V3-PLS)
- **Shadow Mode**: Learns without executing
- **Confidence Evolution**: Improves over time
- **Pattern Types**:
  - FAQ responses
  - Action triggers
  - Routing decisions
  - Response templates
- **Safety Features**:
  - Human approval queue
  - Confidence thresholds
  - Audit logging
  - Rollback capability

### 4. Communication System

#### OpenPhone Integration
- **SMS/Voice**: Full conversation tracking
- **Webhook Processing**: Real-time message handling
- **AI Response**: Automatic reply generation
- **Operator Interface**: Unified messaging dashboard

#### Slack Integration
- **Webhooks**: System notifications
- **Commands**: Operator controls
- **Threading**: Conversation organization
- **Attachments**: Rich message formatting

#### Notification System
- **Push Notifications**: Web Push API
- **Preferences**: User-configurable
- **Quiet Hours**: Time-based filtering
- **Types**: Messages, tickets, system alerts

## Database Schema

### Core Tables

#### User Management
- `users`: Core user accounts
- `customer_profiles`: Extended customer data
- `user_sessions`: Active sessions
- `token_blacklist`: Revoked tokens

#### Gamification
- `club_coins`: Currency system
- `challenges`: Competition system
- `achievements`: Player accomplishments
- `tiers`: Ranking levels
- `boxes`: Reward containers
- `leaderboards`: Competitive rankings

#### Operations
- `tickets`: Support system
- `checklists`: Maintenance tasks
- `system_settings`: Configuration
- `audit_logs`: Activity tracking

#### AI/ML
- `ai_automation_features`: Automation configs
- `decision_patterns`: Learned patterns
- `pattern_execution_history`: Pattern usage
- `confidence_evolution`: Learning metrics

#### Communication
- `openphone_conversations`: SMS/call tracking
- `messages`: Communication history
- `notifications`: Push notification logs
- `slack_threads`: Slack integration

## API Structure

### Authentication Endpoints
- `POST /api/auth/signup` - Customer registration
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - Session termination
- `GET /api/auth/verify` - Token validation
- `POST /api/auth/refresh` - Token renewal

### Customer Endpoints
- `GET /api/customer/profile` - Profile data
- `PUT /api/customer/profile` - Update profile
- `GET /api/customer/bookings` - Booking history
- `GET /api/customer/achievements` - Accomplishments
- `GET /api/customer/friends` - Social connections

### Operator Endpoints
- `GET /api/admin/users` - User management
- `GET /api/analytics/*` - Performance metrics
- `POST /api/tickets` - Support tickets
- `GET /api/system-status` - Health monitoring

### AI/Automation Endpoints
- `POST /api/llm/process` - AI processing
- `GET /api/ai-automations` - Automation status
- `POST /api/patterns/test` - Pattern testing
- `GET /api/knowledge/*` - Knowledge base

## Third-Party Integrations

### Communication
1. **OpenPhone** - SMS/Voice communications
2. **Twilio** - Backup SMS provider
3. **SendGrid** - Email delivery
4. **Slack** - Team notifications

### AI/ML
5. **OpenAI GPT-4** - Language processing
6. **Custom Assistants** - Specialized AI agents

### Infrastructure
7. **NinjaOne** - Remote device management
8. **UniFi Access** - Door control system
9. **Cloudflare** - Tunneling & security

### Analytics & Monitoring
10. **Sentry** - Error tracking
11. **HubSpot** - CRM & bookings
12. **Custom Analytics** - Internal metrics

### Storage & Caching
13. **PostgreSQL** - Primary database
14. **Redis** - Caching layer
15. **Local Storage** - File management

## Security Implementation

### Authentication
- **JWT Tokens**: Role-based expiration
- **Session Management**: Redis-backed sessions
- **Password Security**: bcrypt with salt rounds
- **Token Blacklisting**: Revocation support

### Authorization
- **RBAC**: Role-based access control
- **Middleware Guards**: Route protection
- **API Keys**: Service authentication
- **CSRF Protection**: Token validation

### Data Protection
- **Encryption**: Sensitive data encryption
- **Input Validation**: Express-validator
- **SQL Injection**: Parameterized queries
- **XSS Prevention**: Content sanitization
- **Rate Limiting**: DDoS protection

### Monitoring
- **Audit Logs**: Activity tracking
- **Error Tracking**: Sentry integration
- **Security Headers**: Helmet.js
- **CORS**: Configured origins

## Deployment Architecture

### Production Environment
```
Frontend (Vercel)
    ↓
Load Balancer
    ↓
Backend (Railway)
    ↓
PostgreSQL (Railway)
    ↓
Redis Cache
```

### Deployment Process
1. **Version Control**: GitHub repository
2. **CI/CD**: Auto-deploy on push
3. **Frontend**: Vercel deployment
4. **Backend**: Railway deployment
5. **Database**: Managed PostgreSQL
6. **Monitoring**: Sentry + logs

### Environment Configuration
- **Development**: Local with hot reload
- **Staging**: Railway preview
- **Production**: Full deployment

## Performance Optimizations

### Frontend
- Code splitting
- Image optimization
- Lazy loading
- PWA caching
- CDN delivery

### Backend
- Query optimization
- Redis caching
- Connection pooling
- Response compression
- Rate limiting

### Database
- Indexed queries
- Migration system
- Connection pooling
- Query optimization
- Backup strategy

## Development Workflow

### Local Setup
```bash
# Install dependencies
cd ClubOSV1-backend && npm install
cd ../ClubOSV1-frontend && npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Run migrations
npm run db:migrate

# Start development
npm run dev
```

### Testing
- Unit tests with Jest
- Integration tests
- Security testing
- Performance testing
- User acceptance testing

### Deployment
```bash
# Commit changes
git add -A
git commit -m "feat: description"

# Deploy (auto-triggers)
git push origin main
```

## Maintenance & Operations

### Monitoring
- System health checks
- Error tracking
- Performance metrics
- User analytics
- Security audits

### Backup Strategy
- Daily automated backups
- Point-in-time recovery
- Disaster recovery plan
- Data retention policy

### Updates
- Security patches
- Dependency updates
- Feature deployments
- Database migrations
- Configuration changes

## Future Roadmap

### Planned Features
1. Advanced analytics dashboard
2. Machine learning improvements
3. Mobile app enhancements
4. Payment processing
5. Tournament management
6. Equipment tracking
7. Coaching integration
8. Virtual reality support

### Technical Improvements
- WebSocket real-time updates
- GraphQL API layer
- Microservices architecture
- Kubernetes deployment
- Advanced caching strategies

## Support & Documentation

### Resources
- API documentation
- User guides
- Admin manual
- Developer docs
- Troubleshooting guides

### Contact
- Technical support
- Feature requests
- Bug reports
- Security issues

---

*Last Updated: September 2025*
*Version: 1.12.1*
*Status: Production Ready*