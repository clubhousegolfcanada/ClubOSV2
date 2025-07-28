# OpenPhone Integration Setup Guide

## Prerequisites
- OpenPhone account with API access
- API key from OpenPhone dashboard
- Webhook endpoint configured

## Step 1: Get OpenPhone API Key

1. Log into OpenPhone dashboard
2. Go to Settings → Integrations → API
3. Generate a new API key
4. Copy the key (you won't see it again!)

## Step 2: Configure Environment Variables

Add to your `.env` file:
```env
# OpenPhone Configuration
OPENPHONE_API_KEY=your-api-key-here
OPENPHONE_WEBHOOK_SECRET=generate-a-random-secret-here

# Optional: OpenPhone API URL (defaults to production)
OPENPHONE_API_URL=https://api.openphone.com/v1
```

Generate a webhook secret:
```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: OpenPhone Webhook Configuration

1. In OpenPhone dashboard, go to Settings → Webhooks
2. Add a new webhook:
   - URL: `https://your-domain.com/api/openphone/webhook`
   - Events to subscribe:
     - `message.created`
     - `message.updated` 
     - `conversation.updated`
     - `call.completed`
   - Secret: Use the same secret from your .env file

## Step 4: Test Webhook Locally

Use ngrok for local testing:
```bash
# Install ngrok if you haven't
npm install -g ngrok

# Start your backend
cd ClubOSV1-backend
npm run dev

# In another terminal, expose your local server
ngrok http 3001

# Use the ngrok URL for webhook testing
# e.g., https://abc123.ngrok.io/api/openphone/webhook
```

## Step 5: Webhook Payload Examples

### Message Created
```json
{
  "type": "message.created",
  "data": {
    "id": "msg_123",
    "conversationId": "conv_456",
    "from": "+1234567890",
    "to": "+0987654321",
    "direction": "inbound",
    "text": "Hi, I'm having trouble booking a tee time",
    "createdAt": "2024-01-01T12:00:00Z",
    "contact": {
      "id": "cont_789",
      "name": "John Doe",
      "phoneNumber": "+1234567890"
    },
    "user": {
      "id": "user_321",
      "name": "Support Agent",
      "email": "agent@company.com"
    }
  }
}
```

### Call Completed
```json
{
  "type": "call.completed",
  "data": {
    "id": "call_123",
    "phoneNumber": "+1234567890",
    "direction": "inbound",
    "duration": 180,
    "startedAt": "2024-01-01T12:00:00Z",
    "endedAt": "2024-01-01T12:03:00Z",
    "recordingUrl": "https://recordings.openphone.com/...",
    "contact": {
      "name": "Jane Smith"
    },
    "user": {
      "name": "Support Agent"
    }
  }
}
```

## Step 6: API Integration

The OpenPhone API can be used to:
- Fetch historical conversations
- Send messages programmatically
- Get contact information
- Create notes on conversations

Example API calls are implemented in the test file.

## Troubleshooting

### Webhook not receiving events
1. Check ngrok is running and URL is correct
2. Verify webhook secret matches
3. Check OpenPhone webhook logs for errors

### Signature verification failing
1. Ensure you're using the raw request body
2. Check the secret is exactly the same (no extra spaces)
3. Verify the signature header name is correct

### Missing conversation data
1. OpenPhone may send partial data in webhooks
2. Use the API to fetch full conversation history
3. Check your API rate limits