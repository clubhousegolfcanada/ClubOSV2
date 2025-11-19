# ClubOSV1 Backend

Local-first Node.js backend for the ClubOSV1 golf simulator management system with intelligent bot routing and Slack fallback.

## Features

- **LLM-Powered Routing**: Intelligent request routing using OpenAI
- **Multi-Bot System**:
  - Booking&AccessBot: Handles bookings, refunds, and access control
  - EmergencyBot: Urgent safety and immediate help requests
  - TechSupportBot: Equipment and technical issue resolution
  - BrandToneBot: Marketing and brand-related queries
- **Slack Integration**: Direct messaging and fallback when LLM fails
- **UniFi Access Integration**: Remote door control and access management
- **File-Based Storage**: Local JSON storage with Google Drive sync support
- **Request History**: Complete audit trail and analytics
- **RESTful API**: Well-structured endpoints for all operations

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **AI/LLM**: OpenAI API
- **Messaging**: Slack Webhooks & Events API
- **Validation**: Joi
- **Logging**: Winston
- **Development**: tsx for hot reload

## Project Structure

```
ClubOSV1-backend/
├── src/
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic services
│   ├── middleware/     # Express middleware
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript definitions
│   ├── data/           # Local JSON storage
│   └── index.ts        # Server entry point
├── logs/               # Application logs
└── dist/               # Compiled JavaScript
```

## Secret Rotation Guide

### Generating New Secrets

To generate secure secrets for production:

```bash
npm run generate:secrets
```

This will generate:
- JWT_SECRET (64 characters)
- SESSION_SECRET (64 characters)
- ENCRYPTION_KEY (32 characters)

### Migration Timeline

- **Now - Dec 31, 2024**: Migration mode active
  - Set `SECRET_MIGRATION_MODE=true` in environment
  - Old secrets work with deprecation warnings
  - New secrets can be deployed anytime

- **Jan 1, 2025**: Strict validation enforced
  - Migration mode expires
  - Old/weak secrets will cause startup failure
  - All deployments must use new secrets

### Updating Production (Railway)

1. Generate new secrets:
   ```bash
   npm run generate:secrets
   ```

2. Update Railway Dashboard:
   - Go to Railway Dashboard → ClubOS Backend
   - Navigate to Variables tab
   - Update JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
   - Add `SECRET_MIGRATION_MODE=false`
   - Deploy changes

3. Monitor deployment:
   - Check logs for successful startup
   - Note: All users will need to re-login

### Security Best Practices

- **Never** commit secrets to version control
- Use different secrets for each environment
- Rotate secrets every 90 days
- Store backup copies in secure password manager
- Monitor for unauthorized access after rotation

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (for LLM features)
- Slack webhook URL (for Slack integration)

### Installation

1. Navigate to the backend directory:
```bash
cd ClubOSV1-backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run development server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `POST /api/llm/request` - Process request with LLM
- `POST /api/slack/message` - Send direct to Slack
- `GET /api/history` - Get request history

### Booking Endpoints

- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

### Access Control

- `POST /api/access/request` - Request access
- `GET /api/access/logs` - View access logs
- `GET /api/access/check/:userId` - Check access status
- `POST /api/access/revoke/:id` - Revoke access

### UniFi Door Control

- `GET /api/unifi/doors` - List configured doors
- `POST /api/unifi/doors/:doorId/unlock` - Unlock specific door
- `GET /api/unifi/doors/:doorId/status` - Get door status
- `GET /api/unifi/access-logs` - View door access history

### System Status

- `GET /api/llm/status` - LLM service status
- `GET /api/slack/status` - Slack integration status
- `GET /api/history/stats/overview` - System statistics

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3001)
- `OPENAI_API_KEY` - OpenAI API key for LLM
- `OPENAI_MODEL` - Model to use (default: gpt-4-turbo-preview)
- `SLACK_WEBHOOK_URL` - Slack incoming webhook
- `SLACK_CHANNEL` - Default Slack channel
- `LOG_LEVEL` - Logging level (info, debug, error)
- `DATA_RETENTION_DAYS` - How long to keep logs

#### UniFi Access Configuration

- `UNIFI_CONTROLLER_URL` - UniFi Controller URL
- `UNIFI_CONTROLLER_PORT` - Controller port (default: 8443)
- `UNIFI_USERNAME` - UniFi admin username
- `UNIFI_PASSWORD` - UniFi admin password
- `UNIFI_SITE_ID` - Site ID (default: 'default')
- `UNIFI_DOOR_*` - Door MAC addresses for each location
- `UNIFI_UNLOCK_DURATION` - Default unlock duration in seconds
- `UNIFI_MAX_UNLOCK_DURATION` - Maximum allowed unlock duration
- `UNIFI_EMERGENCY_UNLOCK_DURATION` - Duration for emergency unlocks

### Data Storage

All data is stored in JSON files under `src/data/`:
- `userLogs.json` - Request history
- `bookings.json` - Booking records
- `accessLogs.json` - Access control logs
- `systemConfig.json` - System configuration

Files in `src/data/sync/` are mirrored for Google Drive sync.

## Development

### Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run typecheck` - Check TypeScript types
- `npm run setup:unifi` - Configure UniFi Access integration

### Adding New Routes

1. Create route file in `src/routes/`
2. Import and use in `src/index.ts`
3. Add types to `src/types/index.ts`
4. Document in API section

### Error Handling

Use the `AppError` class for consistent error responses:

```typescript
throw new AppError('ERROR_CODE', 'Error message', 400);
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY src/data ./src/data
EXPOSE 3001
CMD ["npm", "start"]
```

## Monitoring

- Logs are written to `logs/` directory
- Request logs stored in `src/data/logs/requests.json`
- Use `/api/history/stats` endpoints for analytics

## Security

- CORS configured for frontend URL
- Request validation with Joi
- Error messages sanitized in production
- Slack webhook verification available

## Contributing

1. Create feature branch
2. Make changes with tests
3. Ensure TypeScript types are correct
4. Submit pull request

## License

Private - ClubOSV1
