# ClubOS Setup Guide

## Prerequisites
- Node.js 18+ and npm installed
- PostgreSQL database (Railway provides this)
- Access to Slack workspace (for notifications)
- OpenAI API account (for LLM features)

## Quick Start

### 1. Clone Repository
```bash
git clone [your-repo-url]
cd CLUBOSV1
```

### 2. Install Dependencies

```bash
# Backend
cd ClubOSV1-backend
npm install

# Frontend
cd ../ClubOSV1-frontend
npm install
```

### 3. Environment Configuration

#### Backend (.env file)
Create `ClubOSV1-backend/.env`:

```env
# Database (Railway provides this)
DATABASE_URL=postgresql://user:pass@host:port/dbname
NODE_ENV=development

# Authentication
JWT_SECRET=your-32-character-secret-key
SESSION_SECRET=your-session-secret

# Server
PORT=3001
FRONTEND_URL=http://localhost:3000

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
SLACK_CHANNEL=#clubos-requests
SLACK_SIGNING_SECRET=your-signing-secret

# Optional: Facilities notifications
FACILITIES_SLACK_CHANNEL=#facilities
FACILITIES_SLACK_USER=U00000000

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# GPT Assistant IDs (get from OpenAI platform)
BOOKING_ACCESS_GPT_ID=asst_...
EMERGENCY_GPT_ID=asst_...
TECH_SUPPORT_GPT_ID=asst_...
BRAND_MARKETING_GPT_ID=asst_...
```

#### Frontend (.env.local file)
Create `ClubOSV1-frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 4. Database Setup

The system now uses PostgreSQL with automatic migrations:

```bash
cd ClubOSV1-backend

# Tables are created automatically on first run
# Or run migrations manually:
npx ts-node src/scripts/runMigrations.ts
```

### 5. Create Admin User

```bash
cd ClubOSV1-backend
npm run create-admin

# Or use the script directly:
node scripts/createAdmin.ts
```

### 6. Start Development Servers

```bash
# Terminal 1 - Backend
cd ClubOSV1-backend
npm run dev

# Terminal 2 - Frontend
cd ClubOSV1-frontend
npm run dev
```

Visit http://localhost:3000 to access the application.

## Configuration Details

### Slack Setup

1. **Create Slack App**:
   - Go to https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"
   - Name: "ClubOS"
   - Select your workspace

2. **Enable Incoming Webhooks**:
   - Go to "Incoming Webhooks" in sidebar
   - Toggle "Activate Incoming Webhooks" to ON
   - Click "Add New Webhook to Workspace"
   - Select channel (#clubos-requests)
   - Copy webhook URL to .env

3. **Get Signing Secret** (for webhook verification):
   - Go to "Basic Information"
   - Copy "Signing Secret" to .env

### OpenAI Setup

1. **Get API Key**:
   - Visit https://platform.openai.com/api-keys
   - Create new key
   - Add to .env as OPENAI_API_KEY

2. **Create GPT Assistants**:
   - Go to https://platform.openai.com/assistants
   - Create four assistants:
     - Booking & Access Assistant
     - Emergency Response Assistant
     - Tech Support Assistant
     - Brand & Marketing Assistant
   - Copy each assistant ID to corresponding env variable

3. **Configure Assistants** (see `/assistant-instructions/` folder for templates):
   - Each assistant needs specific instructions
   - Use provided JSON schemas for structured responses

### Database Configuration

#### Local PostgreSQL
```bash
# Install PostgreSQL locally
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb clubos_dev

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://localhost:5432/clubos_dev
```

#### Railway PostgreSQL
1. Create Railway project
2. Add PostgreSQL service
3. Copy DATABASE_URL from Railway dashboard

## Verification Steps

### 1. Test Database Connection
```bash
cd ClubOSV1-backend
npx ts-node -e "
const { db } = require('./dist/utils/database');
db.query('SELECT NOW()').then(r => {
  console.log('✅ Database connected:', r.rows[0].now);
}).catch(e => {
  console.error('❌ Database error:', e.message);
});
"
```

### 2. Test Slack Integration
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ ClubOS test message"}' \
  $SLACK_WEBHOOK_URL
```

### 3. Test OpenAI Connection
```bash
cd ClubOSV1-backend
npm run test:openai
```

### 4. Verify System Health
- Backend: http://localhost:3001/health
- API Docs: http://localhost:3001/api-docs (if enabled)

## Common Issues

### Port Already in Use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Connection Failed
- Verify DATABASE_URL format
- Check PostgreSQL is running
- Ensure database exists
- Check firewall/network settings

### Slack Webhook Errors
- Verify webhook URL is active
- Check channel permissions
- Ensure URL is properly formatted

### OpenAI API Errors
- Check API key is valid
- Verify billing is active
- Check rate limits
- Ensure assistant IDs exist

## Development Workflow

### Making Changes
1. Create feature branch
2. Make changes
3. Test locally
4. Run linter: `npm run lint`
5. Run tests: `npm test`
6. Commit with descriptive message

### Building for Production
```bash
# Backend
cd ClubOSV1-backend
npm run build

# Frontend
cd ClubOSV1-frontend
npm run build
```

### Database Migrations
New migrations go in `ClubOSV1-backend/src/database/migrations/`
```bash
# Run pending migrations
npm run migrate

# Create new migration
npm run migrate:create -- migration_name
```

## Security Notes
- Never commit .env files
- Use strong, unique secrets
- Rotate API keys regularly
- Keep dependencies updated
- Enable 2FA on all services

## Additional Resources
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./ClubOSV1-backend/docs/API_USAGE_TRACKING.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Assistant Instructions](./assistant-instructions/)

## Support
For issues:
1. Check error logs
2. Verify environment variables
3. Test individual components
4. Review documentation
5. Check GitHub issues

Last updated: November 2024