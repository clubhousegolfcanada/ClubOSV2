# Slack Reply Tracking Implementation - Phase 1

## Overview
This implementation extends the ClubOS feedback system to track Slack messages and prepare for capturing Slack replies. When requests are sent to Slack, we now store the thread ID to enable future reply tracking.

## What Was Implemented

### 1. Database Schema Updates
- **New table**: `slack_messages` - Stores all messages sent to Slack from ClubOS
- **Updated table**: `feedback` - Added columns for Slack reply tracking:
  - `feedback_source` - Distinguishes between user feedback and Slack replies
  - `slack_thread_ts` - Links feedback to Slack threads
  - `slack_user_name`, `slack_user_id` - Tracks who replied in Slack
  - `slack_channel` - Which Slack channel the reply came from
- **New view**: `slack_replies_view` - Easy querying of Slack replies with context

### 2. TypeScript Type Updates
- Added `SlackMessageRecord` interface for tracking Slack messages
- Added `SlackReply` interface for Slack replies
- Updated `Feedback` interface with new Slack-related fields
- Added `FeedbackSource` type: 'user' | 'slack_reply' | 'system'
- Added Slack Events API types for future webhook implementation

### 3. Service Updates

#### SlackFallbackService (`slackFallback.ts`)
- Now returns thread IDs when sending messages
- Saves all Slack messages to database with metadata
- Added `getSlackMessage()` method to retrieve message by thread ID
- Tracks request details (description, location, route) with each message

#### Feedback Route (`feedback.ts`)
- Updated to save feedback to PostgreSQL
- Maintains backward compatibility with JSON files
- Added new endpoint: `GET /api/feedback/slack-replies`
- Updated existing endpoints to work with both database and JSON

#### LLM Route (`llm.ts`)
- Now captures and stores Slack thread IDs
- Returns thread ID in API responses
- Tracks thread IDs for all Slack interactions

### 4. Database Utilities
- Created `db.ts` for PostgreSQL connection pooling
- Added transaction support
- Includes query logging and error handling
- Created migration runner script

## How to Run Migrations

1. Ensure your DATABASE_URL environment variable is set
2. Run the migration:
   ```bash
   cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend
   npx ts-node src/scripts/runMigrations.ts
   ```

## API Changes

### New Endpoints

#### Get Slack Replies
```
GET /api/feedback/slack-replies?limit=50&offset=0
Authorization: Bearer <token>
```

Returns Slack replies with original request context.

### Updated Responses

The `/api/llm/request` endpoint now includes `slackThreadTs` in responses:
```json
{
  "success": true,
  "data": {
    "requestId": "...",
    "slackThreadTs": "thread_1234567890_abc123",
    // ... other fields
  }
}
```

## Database Migration Details

The migration (`001_add_slack_reply_tracking.sql`) handles:
- Creating tables if they don't exist
- Adding columns safely with IF NOT EXISTS
- Creating indexes for performance
- Setting up a view for easy querying
- Adding triggers for timestamp updates

## Next Steps (Phase 2-4)

### Phase 2: Implement Slack Events API
- Set up webhook endpoint at `/api/slack/events`
- Handle URL verification challenge
- Process message events
- Store replies as feedback

### Phase 3: Update Operations UI
- Add Slack replies section
- Show thread conversations
- Link replies to original requests

### Phase 4: Real-time Notifications
- Implement polling endpoint
- Add SSE for real-time updates
- Update frontend to show notifications

## Environment Variables Needed

Add these to your `.env` file:
```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL=#clubos-requests
```

## Testing the Implementation

1. Send a request to Slack:
   - Use the request form with Smart Assist disabled
   - Note the returned `slackThreadTs`

2. Check the database:
   ```sql
   SELECT * FROM slack_messages ORDER BY created_at DESC LIMIT 5;
   ```

3. Verify feedback endpoints work:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:3001/api/feedback/slack-replies
   ```

## Important Notes

- Thread IDs are currently generated locally (will be replaced with real Slack thread_ts in Phase 2)
- The system maintains backward compatibility with JSON files
- All Slack messages are tracked, including tickets and feedback notifications
- Database operations have fallbacks to prevent failures

## Phase 1 Completion Status ✅

### What Was Successfully Implemented:
1. **Database Setup**
   - ✅ Created `feedback` table with Slack-related columns
   - ✅ Created `slack_messages` table for tracking sent messages
   - ✅ Created indexes for performance
   - ✅ Created `slack_replies_view` for easy querying
   - ✅ Migration system working correctly

2. **Code Updates**
   - ✅ Updated TypeScript types with Slack interfaces
   - ✅ Modified `slackFallback.ts` to save and return thread IDs
   - ✅ Updated `feedback.ts` routes with PostgreSQL support
   - ✅ Modified `llm.ts` to capture and return thread IDs
   - ✅ Created `db.ts` for database connections

3. **Environment Configuration**
   - ✅ `DATABASE_URL` configured and working
   - ✅ `SLACK_WEBHOOK_URL` configured
   - ✅ `SLACK_CHANNEL=#clubos-assistants` added

### Key Learnings from Implementation:
1. **Database Migration Issues**
   - PostgreSQL case sensitivity: "Users" vs "users"
   - Migration runner had issues with complex SQL statements
   - Solution: Direct SQL execution for initial setup

2. **Connection Issues**
   - Need to use `DATABASE_PUBLIC_URL` for local development
   - Railway provides different URLs for internal/external access
   - dotenv must be loaded explicitly in scripts

## Troubleshooting

If migrations fail:
1. Check DATABASE_URL is correct
2. Ensure PostgreSQL is running
3. Check user has CREATE TABLE permissions
4. Review migration logs for specific errors

If Slack messages aren't being tracked:
1. Verify SLACK_WEBHOOK_URL is set
2. Check logs for "Slack message record saved"
3. Ensure database connection is working
4. Check the slack_messages table