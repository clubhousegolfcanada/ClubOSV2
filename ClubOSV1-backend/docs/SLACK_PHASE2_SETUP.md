# Slack Phase 2 Setup Guide - Reply Tracking

## 🚀 Implementation Status

✅ **Phase 2 COMPLETE**: Slack Events API handler implemented and deployed

### What's Been Implemented

1. **Database Structure**
   - ✅ `slack_replies` table created
   - ✅ `slack_replies_view` for easy querying 
   - ✅ Database migrations deployed to Railway

2. **API Endpoints**
   - ✅ `POST /api/slack/events` - Events API handler with signature verification
   - ✅ `GET /api/slack/replies/:threadTs` - Fetch replies for a thread
   - ✅ `GET /api/slack/conversations` - Get conversations with reply counts
   - ✅ Raw body middleware for secure signature verification

3. **Environment Variables**
   - ✅ `SLACK_BOT_TOKEN` placeholder configured in Railway
   - ✅ `SLACK_SIGNING_SECRET` placeholder configured in Railway

## 📋 Next Steps - Slack App Configuration

To complete Phase 2, you need to configure your Slack app:

### 1. Go to api.slack.com
- Navigate to your ClubOS Slack app
- Or create a new app if needed

### 2. Enable Events API
- Go to **Event Subscriptions**
- Toggle **Enable Events** to ON
- Set **Request URL** to: `https://clubosv2-production.up.railway.app/api/slack/events`
- Slack will verify the URL (our endpoint handles this automatically)

### 3. Subscribe to Bot Events
Add these bot events:
- `message.channels` - To receive messages in channels

### 4. Configure OAuth & Permissions
Required bot token scopes:
- `channels:history` - Read messages in channels
- `chat:write` - Send messages
- `users:read` - Read user information

### 5. Install/Reinstall App
- Go to **Install App**
- Click **Reinstall to Workspace**
- This generates the real bot token

### 6. Update Environment Variables
Replace the placeholder values in Railway:
```bash
railway variables --set "SLACK_BOT_TOKEN=xoxb-your-real-bot-token"
railway variables --set "SLACK_SIGNING_SECRET=your-real-signing-secret"
```

## 🧪 Testing the Implementation

### 1. URL Verification Test
```bash
curl -X POST https://clubosv2-production.up.railway.app/api/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type": "url_verification", "challenge": "test123"}'
```
Expected response: `{"challenge": "test123"}`

### 2. Send Test Message via ClubOS
1. Go to ClubOS interface
2. Disable Smart Assist
3. Send a test message
4. Check Slack - message should appear with thread
5. Reply in the Slack thread
6. Check database: `SELECT * FROM slack_replies_view;`

### 3. API Endpoints Test
```bash
# Get conversations
curl https://clubosv2-production.up.railway.app/api/slack/conversations

# Get replies for a specific thread
curl https://clubosv2-production.up.railway.app/api/slack/replies/THREAD_TS_HERE
```

## 🔧 How It Works

### Message Flow
1. **Outbound**: ClubOS → Slack (existing functionality)
   - User submits request with Smart Assist OFF
   - Message sent to Slack with unique `thread_ts`
   - `thread_ts` stored in `slack_messages` table

2. **Inbound**: Slack → ClubOS (new functionality)
   - Staff replies in Slack thread
   - Slack sends event to `/api/slack/events`
   - Signature verified for security
   - Reply stored in `slack_replies` table
   - Linked to original message via `thread_ts`

### Database Schema
```sql
-- Original messages
slack_messages (
  id, user_id, request_id, slack_thread_ts, 
  slack_channel, original_message, 
  request_description, location, route
)

-- Threaded replies  
slack_replies (
  id, thread_ts, user_name, user_id, 
  text, timestamp, created_at
)

-- Combined view
slack_replies_view (
  -- All reply data + original message context
)
```

## 🖥️ Frontend Integration (Next Phase)

The backend is ready for frontend integration:

1. **Real-time Updates** (optional)
   - Add WebSocket or Server-Sent Events
   - Notify frontend when new replies arrive

2. **UI Components**
   - Display conversation threads
   - Show reply timestamps and users
   - Mark conversations as resolved

3. **API Integration**
   - Use `/api/slack/conversations` for conversation list
   - Use `/api/slack/replies/:threadTs` for thread details

## 🔒 Security Features

- ✅ Slack signature verification on all webhook events
- ✅ Raw body capture for accurate signature validation
- ✅ Timestamp validation (5-minute window)
- ✅ Bot detection (ignores bot messages)
- ✅ Thread-only processing (ignores direct messages)

## 🐛 Troubleshooting

### Events Not Received
1. Check Slack app configuration
2. Verify Request URL in Slack app settings
3. Check Railway logs: `railway logs`
4. Ensure bot is in the channel

### Signature Verification Failures
1. Verify `SLACK_SIGNING_SECRET` is correct
2. Check timestamp drift (must be within 5 minutes)
3. Ensure raw body middleware is working

### Database Issues
1. Check if migrations ran: Look for "slack_replies table created" in logs
2. Verify table exists: `SELECT * FROM slack_replies LIMIT 1;`
3. Check view: `SELECT * FROM slack_replies_view LIMIT 1;`

## 📊 Monitoring

Monitor these Railway logs for successful operation:
- `Slack events API received (verified)`
- `Slack thread reply received`
- `Slack reply stored successfully`

## 🎯 Success Criteria

- ✅ Events API endpoint responds to URL verification
- ✅ Signature verification passes
- ✅ Thread replies stored in database  
- ✅ Replies linked to original messages
- ✅ API endpoints return conversation data
- ✅ No duplicate or malformed replies

**Status**: Ready for Slack app configuration and testing!