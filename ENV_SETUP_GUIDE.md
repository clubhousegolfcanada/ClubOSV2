# ClubOS Environment Variables Setup Guide

## Required Environment Variables for Slack Reply Tracking

### 1. Database Configuration

```bash
# PostgreSQL Database URL (from Railway)
DATABASE_URL=postgresql://username:password@host:port/database_name

# Node Environment
NODE_ENV=development  # or 'production' for Railway deployment
```

### 2. Current Slack Integration Variables

```bash
# Slack Webhook URL (for sending messages TO Slack)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX

# Default Slack Channel
SLACK_CHANNEL=#clubos-requests

# Optional: Facilities-specific configuration
FACILITIES_SLACK_CHANNEL=#facilities-requests  # Optional: separate channel for facilities
FACILITIES_SLACK_USER=U00000000  # Optional: Slack user ID to @mention for facilities
```

### 3. Future Slack Variables (for Phase 2)

```bash
# These will be needed when implementing Slack Events API
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_ID=A00000000
```

### 4. Other Required Variables (from existing system)

```bash
# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key

# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# OpenAI Assistant IDs
BOOKING_ACCESS_GPT_ID=asst_...
EMERGENCY_GPT_ID=asst_...
TECH_SUPPORT_GPT_ID=asst_...
BRAND_MARKETING_GPT_ID=asst_...

# Server Configuration
PORT=3001
```

## How to Set Up Your Environment Variables

### Option 1: Local Development (.env file)

1. Create a `.env` file in your backend directory:
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend
touch .env
```

2. Add the variables to the `.env` file:
```env
# Database
DATABASE_URL=postgresql://username:password@host:5432/dbname
NODE_ENV=development

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#clubos-requests

# Authentication
JWT_SECRET=your-secret-key-here

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4-turbo-preview

# Assistant IDs
BOOKING_ACCESS_GPT_ID=asst_your_booking_assistant_id
EMERGENCY_GPT_ID=asst_your_emergency_assistant_id
TECH_SUPPORT_GPT_ID=asst_your_tech_support_assistant_id
BRAND_MARKETING_GPT_ID=asst_your_brand_assistant_id

# Server
PORT=3001
```

### Option 2: Railway Deployment

1. Go to your Railway project dashboard
2. Click on your backend service
3. Go to the "Variables" tab
4. Add each variable one by one

Railway automatically provides `DATABASE_URL` when you provision a PostgreSQL database.

## Getting Your Slack Webhook URL

1. Go to https://api.slack.com/apps
2. Click on your app (or create a new one)
3. Go to "Incoming Webhooks" in the left sidebar
4. Toggle "Activate Incoming Webhooks" to ON
5. Click "Add New Webhook to Workspace"
6. Choose the channel (#clubos-requests)
7. Copy the webhook URL

## Example Complete .env File

```env
# Database (Railway provides this automatically)
DATABASE_URL=postgresql://postgres:AbCdEfGhIjKlMnOp@containers-us-west-123.railway.app:6789/railway
NODE_ENV=production

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T04ABC123/B04DEF456/abcdef123456789
SLACK_CHANNEL=#clubos-requests
FACILITIES_SLACK_CHANNEL=#facilities
FACILITIES_SLACK_USER=U04ABC123

# Auth
JWT_SECRET=my-super-secret-jwt-key-change-this-in-production

# OpenAI
OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456
OPENAI_MODEL=gpt-4-turbo-preview

# Assistants
BOOKING_ACCESS_GPT_ID=asst_abc123
EMERGENCY_GPT_ID=asst_def456
TECH_SUPPORT_GPT_ID=asst_ghi789
BRAND_MARKETING_GPT_ID=asst_jkl012

# Server
PORT=3001
```

## Verifying Your Setup

After setting up your environment variables:

1. **Test Database Connection**:
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend
npx ts-node -e "require('./src/utils/db').query('SELECT NOW()').then(r => console.log('DB Connected:', r.rows[0]))"
```

2. **Test Slack Webhook**:
```bash
curl -X POST -H 'Content-type: application/json' \
--data '{"text":"Test message from ClubOS setup"}' \
YOUR_SLACK_WEBHOOK_URL
```

3. **Run the migration**:
```bash
npx ts-node src/scripts/runMigrations.ts
```

## Security Notes

- **Never commit `.env` files to Git**
- Add `.env` to your `.gitignore` file
- Use different values for development and production
- Rotate secrets regularly
- Use strong, random values for JWT_SECRET

## Need Help?

If you're missing any values:
- **DATABASE_URL**: Check Railway dashboard or create a PostgreSQL database
- **SLACK_WEBHOOK_URL**: Follow the Slack setup guide above
- **JWT_SECRET**: Generate with `openssl rand -base64 32`
- **OpenAI Keys**: Get from https://platform.openai.com/api-keys
- **Assistant IDs**: Create at https://platform.openai.com/assistants