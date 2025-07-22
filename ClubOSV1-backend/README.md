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
