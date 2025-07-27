# ClubOS Slack Integration

## Current Status

### Phase 1: Outbound Messages ✅ COMPLETE
- Sends requests to Slack when Smart Assist is disabled
- Sends direct requests for customer kiosk mode
- Stores thread IDs in PostgreSQL
- Configurable notifications via Operations page

### Phase 2: Reply Tracking ⏳ PENDING
- Requires Slack Events API setup
- Will enable two-way communication
- Real-time reply notifications

## Configuration

### Environment Variables
```env
# Required
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
SLACK_CHANNEL=#clubos-requests

# Optional
FACILITIES_SLACK_CHANNEL=#facilities
FACILITIES_SLACK_USER=U00000000  # User ID to @mention
SLACK_SIGNING_SECRET=your-signing-secret  # For webhook verification
```

### System Configuration
In Operations page → System Config:
- Enable/disable Slack notifications
- Control when notifications are sent:
  - On LLM success
  - On LLM failure
  - Direct requests
  - Tickets
  - Unhelpful feedback

## Features

### 1. Smart Routing
When Smart Assist is OFF, requests go directly to Slack with:
- User information
- Request description
- Location context
- Timestamp
- Request ID for tracking

### 2. Notification Types

#### Direct Messages
For customer requests bypassing AI:
```
New Request (Direct to Slack)
From: John Doe (john@example.com)
Location: Bay 3
Request: "Need help with frozen screen"
```

#### LLM Failures
When AI processing fails:
```
LLM Processing Failed - Manual Review Required
Error: Timeout/API failure
Original request: "..."
```

#### Ticket Creation
High-priority notifications:
```
@facilities-team - New URGENT Priority Ticket
Category: Facilities
Title: Water leak in bay 2
Created by: Staff member
```

#### Unhelpful Feedback
When users mark responses as not helpful:
```
UNHELPFUL RESPONSE ALERT
User marked AI response as not helpful
Request: "..."
AI Response: "..."
Route: Tech Support
Confidence: 85%
```

## Database Schema

### slack_messages Table
```sql
CREATE TABLE slack_messages (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255),
  request_id VARCHAR(255),
  slack_thread_ts VARCHAR(255) UNIQUE,
  slack_channel VARCHAR(255),
  original_message JSONB,
  request_description TEXT,
  location VARCHAR(255),
  route VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Send to Slack
```bash
POST /api/llm/request
{
  "requestDescription": "Help needed",
  "smartAssistEnabled": false  # Forces Slack
}
```

### Get Slack Message
```bash
GET /api/slack/message/:threadTs
```

## Implementation Details

### SlackFallbackService
- Handles all Slack communications
- Generates thread IDs for tracking
- Stores messages in database
- Formats messages with proper structure

### Notification Control
System checks configuration before sending:
```javascript
const slackConfig = await getSystemConfig('slack_notifications');
if (slackConfig.enabled && slackConfig.sendOnLLMSuccess) {
  // Send notification
}
```

## Testing

### 1. Test Webhook
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"ClubOS test message"}' \
  $SLACK_WEBHOOK_URL
```

### 2. Test Direct Message
```bash
curl -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{
    "requestDescription": "Test slack integration",
    "smartAssistEnabled": false
  }'
```

### 3. Verify Database Entry
```sql
SELECT * FROM slack_messages 
ORDER BY created_at DESC 
LIMIT 1;
```

## Future Enhancements (Phase 2)

### Slack Events API
To enable reply tracking:

1. **Create Slack App**
   - Enable Events API
   - Subscribe to `message.channels` event
   - Set Request URL to your webhook endpoint

2. **Implement Webhook Handler**
   ```javascript
   router.post('/api/slack/events', (req, res) => {
     // Verify signature
     // Process event
     // Store reply in database
     // Trigger notifications
   });
   ```

3. **Real-time Updates**
   - WebSocket connection for live updates
   - Or polling mechanism as fallback
   - Update UI when replies arrive

### Reply Storage
```sql
CREATE TABLE slack_replies (
  id UUID PRIMARY KEY,
  thread_ts VARCHAR(255) REFERENCES slack_messages(slack_thread_ts),
  user_name VARCHAR(255),
  user_id VARCHAR(255),
  text TEXT,
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Common Issues

1. **Webhook Not Working**
   - Verify URL is correct
   - Check channel exists
   - Ensure app has permissions

2. **Messages Not Storing**
   - Check database connection
   - Verify table exists
   - Check for SQL errors

3. **No Notifications**
   - Check system configuration
   - Verify feature is enabled
   - Check specific notification type

### Debug Commands
```bash
# Check Slack configuration
curl http://localhost:3001/api/system-config/slack_notifications

# View recent Slack messages
psql $DATABASE_URL -c "SELECT * FROM slack_messages ORDER BY created_at DESC LIMIT 5;"

# Test notification settings
curl -X PUT http://localhost:3001/api/system-config/slack_notifications \
  -H "Content-Type: application/json" \
  -d '{"value": {"enabled": true, "sendOnLLMSuccess": true}}'
```

Last updated: November 2024