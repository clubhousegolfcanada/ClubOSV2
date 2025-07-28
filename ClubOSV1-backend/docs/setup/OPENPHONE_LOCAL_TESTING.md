# OpenPhone Local Testing Guide

## Quick Start

1. **Add to your .env file:**
```env
# Required
OPENPHONE_WEBHOOK_SECRET=test-secret-12345

# Optional (for API integration)
OPENPHONE_API_KEY=your-api-key-here
```

2. **Start the backend:**
```bash
cd ClubOSV1-backend
npm run dev
```

3. **Run the test suite:**
```bash
# In another terminal
npm run test:openphone
```

## What the Tests Do

### 1. Webhook Testing
- Simulates OpenPhone sending webhooks to your local server
- Tests message creation, conversation updates, and call completions
- Verifies signature validation
- Stores test data in your local database

### 2. Knowledge Extraction Testing
- Creates sample conversations with problems and solutions
- Runs the extraction process
- Shows what knowledge would be extracted

### 3. API Integration (if API key provided)
- Tests connection to OpenPhone
- Lists your phone numbers
- Can import real historical conversations

## Testing Without OpenPhone Account

You can test everything except the API integration:

1. Run `npm run test:openphone`
2. Check the console output
3. Look in the database for stored test conversations
4. Try the Knowledge Extraction UI in the admin panel

## Testing With OpenPhone Account

1. Get your API key from OpenPhone dashboard
2. Add to .env: `OPENPHONE_API_KEY=your-key`
3. Run `npm run test:openphone`
4. The test will import real conversations

## Webhook Testing with ngrok

For real webhook testing:

```bash
# Install ngrok
npm install -g ngrok

# Expose your local server
ngrok http 3001

# Use the ngrok URL in OpenPhone webhook settings
# Example: https://abc123.ngrok.io/api/openphone/webhook
```

## Checking Results

### Database
```sql
-- Check stored conversations
SELECT * FROM openphone_conversations ORDER BY created_at DESC;

-- Check extracted knowledge
SELECT * FROM extracted_knowledge ORDER BY created_at DESC;

-- Check shadow comparisons
SELECT * FROM sop_shadow_comparisons ORDER BY created_at DESC;
```

### Admin UI
1. Go to Operations → Knowledge
2. Check the Stats tab for overview
3. Use Extract tab to process conversations
4. Review tab shows extracted knowledge

## Common Issues

### "Not Connected" in UI
- Check OPENPHONE_API_KEY is set
- Restart the backend server
- Check console for connection errors

### No conversations appearing
- Run the import historical data function
- Check OpenPhone webhook is configured
- Verify webhook secret matches

### Knowledge extraction not working
- Ensure OpenAI API key is configured
- Check you have unprocessed conversations
- Look for errors in backend console

## Next Steps

After successful local testing:

1. Configure production environment variables
2. Set up OpenPhone webhooks to production URL
3. Import historical conversations
4. Start shadow mode testing
5. Monitor results before switching to SOP module