# ClubOS - Golf Simulator Management System

Comprehensive management platform for ClubHouse247 Golf facilities. Features intelligent request routing, ticket management, and customer-facing kiosk interface.

## 🎯 Overview

ClubOS streamlines golf simulator facility operations by:
- Processing customer and staff requests through AI or human support
- Managing support tickets for facilities and technical issues
- Providing customer self-service through ClubOS Boy kiosk interface
- Tracking performance metrics and feedback

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- OpenAI API key
- Slack webhook URL
- Railway account (for deployment)

### Installation

```bash
# Clone repository
git clone [repository-url]
cd ClubOSV1

# Install frontend dependencies
cd ClubOSV1-frontend
npm install

# Install backend dependencies
cd ../ClubOSV1-backend
npm install
```

### Environment Configuration

#### Backend (.env)
```env
# Server
PORT=3001
NODE_ENV=development

# Database (Railway provides DATABASE_URL automatically)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
JWT_SECRET=your-secure-jwt-secret

# AI Services
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#clubos-requests

# OpenAI Assistants (optional)
BOOKING_ACCESS_GPT_ID=asst_...
EMERGENCY_GPT_ID=asst_...
TECH_SUPPORT_GPT_ID=asst_...
BRAND_MARKETING_GPT_ID=asst_...
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Running Locally

```bash
# Start backend (Terminal 1)
cd ClubOSV1-backend
npm run dev

# Start frontend (Terminal 2)
cd ClubOSV1-frontend
npm run dev
```

Access the application at: http://localhost:3000

### Initial Setup

1. **Create admin user:**
   ```bash
   cd ClubOSV1-backend
   npm run create:admin
   # Default: admin@clubhouse247golf.com / admin123
   ```

2. **Create kiosk user (for customer terminals):**
   ```bash
   npm run create:kiosk
   # Generates unique credentials for kiosk mode
   ```

## 🎨 Features

### 1. Smart Request Processing
- **AI-Powered Routing**: Automatically routes requests to appropriate departments
- **Smart Assist Toggle**: Switch between AI processing and direct Slack messaging
- **Route Selection**: Manual override for specific departments:
  - Auto (AI decides)
  - Emergency
  - Booking & Access
  - Tech Support
  - Brand Tone

### 2. Ticket Management System
- **Create Tickets**: Convert requests into trackable tickets
- **Categories**: Facilities and Tech Support
- **Priority Levels**: Low, Medium, High, Urgent
- **Status Tracking**: Open, In Progress, Resolved, Closed
- **Comments**: Add notes and updates to tickets
- **Filtering**: View by status, category, or all tickets

### 3. User Management
- **Role-Based Access Control**:
  - **Admin**: Full system access
  - **Operator**: Tickets and operations management
  - **Support**: Basic features access
  - **Kiosk**: Customer-facing interface only
- **User CRUD Operations**: Create, update, delete users
- **Password Management**: Secure password reset functionality

### 4. ClubOS Boy (Customer Kiosk)
- **Simplified Interface**: Touch-friendly design for public use
- **Auto-Reset**: Returns to home after 30 seconds
- **Direct to Slack**: All customer questions routed to staff
- **Location Context**: Optional location field for better support

### 5. Operations Dashboard
- **User Management**: Add/edit/delete users
- **Feedback Analytics**: Track helpful vs unhelpful AI responses
- **System Health**: Monitor request processing
- **Data Management**: Backup and restore functionality

### 6. Feedback System
- **Response Rating**: Users mark AI responses as helpful/not helpful
- **Continuous Improvement**: Track patterns in unhelpful responses
- **Export for Training**: Download feedback data for AI improvement

## 🏗️ Architecture

### Frontend Stack
- **Framework**: Next.js 13+
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Icons**: Lucide React

### Backend Stack
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL (Railway)
- **Authentication**: JWT with bcrypt
- **AI Integration**: OpenAI GPT-4
- **External Services**: Slack Webhooks

### Deployment
- **Platform**: Railway
- **Database**: PostgreSQL on Railway
- **CI/CD**: GitHub integration
- **SSL**: Handled by Railway

## 📁 Project Structure

```
ClubOSV1/
├── ClubOSV1-frontend/
│   ├── src/
│   │   ├── pages/          # Next.js pages
│   │   ├── components/     # React components
│   │   ├── state/         # State management
│   │   ├── hooks/         # Custom hooks
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript types
│   └── public/            # Static assets
│
└── ClubOSV1-backend/
    ├── src/
    │   ├── routes/        # API endpoints
    │   ├── services/      # Business logic
    │   ├── middleware/    # Express middleware
    │   ├── utils/        # Helpers
    │   ├── types/        # TypeScript types
    │   └── scripts/      # Admin utilities
    └── data/             # File storage (legacy)
```

## 🔒 Security

- **Authentication**: JWT-based with 7-day expiration
- **Password Requirements**: 8+ characters, uppercase, lowercase, number
- **Role-Based Access**: Granular permissions per user role
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS**: Configured for production domains

## 🛠️ Development

### Commands

#### Frontend
```bash
npm run dev       # Development server
npm run build     # Production build
npm run start     # Production server
npm run lint      # Run ESLint
```

#### Backend
```bash
npm run dev       # Development with hot reload
npm run build     # Compile TypeScript
npm start         # Production server
npm run lint      # Run ESLint
npm run test      # Run tests

# Admin scripts
npm run create:admin   # Create admin user
npm run create:kiosk   # Create kiosk user
npm run reset:admin    # Reset admin password
```

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create user (admin only)
- `GET /api/auth/me` - Current user info
- `POST /api/auth/change-password` - Change password

#### Requests
- `POST /api/llm/request` - Process request with AI
- `GET /api/llm/status` - LLM service status

#### Tickets
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket
- `PATCH /api/tickets/:id/status` - Update status
- `POST /api/tickets/:id/comments` - Add comment
- `DELETE /api/tickets/:id` - Delete ticket

#### Feedback
- `POST /api/feedback` - Submit feedback
- `GET /api/feedback/not-useful` - Get unhelpful responses
- `GET /api/feedback/export` - Export feedback data

#### Customer
- `POST /api/customer/ask` - Customer kiosk endpoint
- `GET /api/customer/stats` - Usage statistics

## 🚀 Deployment

### Railway Deployment

1. **Connect GitHub repository** to Railway
2. **Add environment variables** in Railway dashboard
3. **Deploy services**:
   - Frontend service
   - Backend service
   - PostgreSQL database
4. **Configure domains** if using custom URLs

### Database Migrations

```sql
-- Run these on first deployment
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables are created automatically by the application
-- Or use migration scripts in /migrations
```

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection failed | Check DATABASE_URL in Railway |
| OpenAI errors | Verify API key and billing |
| Slack not receiving messages | Check webhook URL and channel |
| Authentication issues | Clear localStorage and re-login |
| Kiosk mode not working | Ensure kiosk user role is set |

## 📊 Usage Flow

### Staff Usage
1. Login with credentials
2. Enter request description
3. Choose Smart Assist (AI) or Slack
4. Submit and receive response
5. Rate response as helpful/not helpful

### Customer Usage (ClubOS Boy)
1. Access kiosk interface (no login)
2. Type question
3. Add location (optional)
4. Submit - goes directly to staff

### Ticket Creation
1. Toggle "Ticket Mode" on main page
2. Enter description
3. Select category and priority
4. Submit to create ticket

## 🔮 Roadmap

### In Progress
- [ ] Slack reply tracking
- [ ] Real-time notifications
- [ ] WebSocket support

### Planned
- [ ] Email notifications
- [ ] Advanced analytics dashboard
- [ ] Mobile app
- [ ] Multi-language support
- [ ] API rate limiting per user
- [ ] Automated backups

## 👥 Contributing

This is a private project for ClubHouse247 Golf. For access or questions, contact the development team.

## 📄 License

Proprietary - All rights reserved by ClubHouse247 Golf.

---

Built with ❤️ for autonomous golf facility management
