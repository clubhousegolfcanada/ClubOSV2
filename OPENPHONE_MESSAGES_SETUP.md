# OpenPhone Messages Setup Guide

## Environment Variables Required

Add these to your `.env` files:

### Backend (.env)
```bash
# OpenPhone API Configuration
OPENPHONE_API_KEY=your_api_key_here
OPENPHONE_WEBHOOK_SECRET=your_webhook_secret_here
OPENPHONE_DEFAULT_NUMBER=+1234567890  # Your OpenPhone number for sending
```

### Frontend (.env.local)
```bash
# API URL (if not already set)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Database Migration

Run the migration to add Messages support:

```bash
# For local development
psql -U your_username -d your_database -f ClubOSV1-backend/src/database/migrations/017_openphone_messages_enhancement.sql

# For production (Railway)
# The migration should run automatically on deploy, but you can run manually if needed
```

## OpenPhone Webhook Configuration

1. Log into your OpenPhone account
2. Go to Settings > Integrations > Webhooks
3. Add a new webhook with:
   - URL: `https://your-api-domain.com/api/openphone/webhook`
   - Events: Select all message and conversation events
   - Copy the webhook secret and add to OPENPHONE_WEBHOOK_SECRET

## Testing the Feature

1. Start both backend and frontend:
   ```bash
   # Backend
   cd ClubOSV1-backend
   npm run dev

   # Frontend
   cd ClubOSV1-frontend
   npm run dev
   ```

2. Navigate to `/messages` in your browser
3. Send a test SMS to your OpenPhone number
4. You should see it appear in the conversations list

## Troubleshooting

### No messages appearing
- Check OpenPhone webhook is configured correctly
- Verify OPENPHONE_API_KEY is set
- Check backend logs for webhook events

### Can't send messages
- Ensure OPENPHONE_DEFAULT_NUMBER is set
- Verify your OpenPhone API key has send permissions
- Check network/CORS settings

### Database errors
- Run the migration manually
- Check that previous migrations have been applied
- Verify database connection settings

## Security Notes

1. Never commit `.env` files
2. Use different API keys for dev/staging/production
3. Rotate webhook secrets periodically
4. Monitor API usage for anomalies

## Rate Limiting

The send endpoint is protected by the general API rate limiter. Consider adding a specific limiter if needed:

```javascript
// In ClubOSV1-backend/src/middleware/rateLimiter.ts
export const messageSendLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute per IP
  message: 'Too many messages sent, please try again later'
});
```

Then apply to the send route:
```javascript
router.post('/send', authenticate, messageSendLimiter, ...)
```