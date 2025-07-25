# ClubOS Slack Integration - Implementation Context Document

## Project Overview
I'm working on ClubOS, a golf simulator management system that currently:
- Sends requests to either an AI assistant or Slack for human support
- Has a feedback system where users mark AI responses as helpful/not helpful
- Uses a React frontend with TypeScript and a Node.js/Express backend
- Stores data in JSON files (not a traditional database)

## Current Architecture
Current stack:
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL (hosted on Railway)
- Deployment: Railway for both frontend and backend
- Currently no WebSocket implementation
- No Slack webhook integration yet

## Existing Feedback System
Current feedback implementation:
- Users can mark AI responses as "useful" or "not useful"
- Feedback is stored in feedback.json
- Operations page shows "not useful" feedback for review
- Feedback includes: requestDescription, response, route, confidence, timestamp

## Goal Statement
I want to implement Slack reply tracking where:
1. When a request is sent to Slack, we store the Slack thread ID
2. When someone replies in Slack, it appears in the feedback log
3. Operations page shows both user feedback and Slack replies
4. Users get real-time notifications when Slack replies arrive

## Specific Requirements
Key requirements:
- Track Slack thread IDs when messages are sent
- Implement Slack Events API to receive replies
- Store Slack replies as a new feedback type
- Show Slack replies in Operations page
- Real-time notifications (considering we don't have WebSockets yet)
- Work within our JSON file storage constraints

## Current Code Structure
Relevant files:
- Backend routes: /src/routes/feedback.ts, /src/routes/llm.ts
- Services: /src/services/slackFallback.ts
- Frontend: /src/pages/operations.tsx, /src/components/RequestForm.tsx
- Types: /src/types/index.ts

## Constraints
Important constraints:
- PostgreSQL database on Railway
- No existing WebSocket setup
- No Slack webhook receiver implemented
- Must maintain backward compatibility
- Authentication using JWT tokens

## Implementation Phases
Suggested approach based on the plan:
- Phase 1: Extend feedback system to track Slack messages
- Phase 2: Implement Slack Events API webhook
- Phase 3: Update Operations page UI
- Phase 4: Add real-time notifications (polling or SSE as alternative to WebSockets)

## Development Preferences

### Commit Script Format
Always provide a commit command at the end of implementations:
```bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Add Slack reply tracking to feedback system

- Extend feedback table to include Slack replies
- Implement Slack Events API webhook handler
- Track thread IDs when sending messages to Slack
- Store Slack replies as new feedback type
- Update Operations page to show Slack responses
- Add real-time notification system for replies"
git push origin main
```

### Code Style Preferences
- Always provide complete file contents (no truncation)
- Use TypeScript for all new files
- Follow existing patterns in the codebase
- Include proper error handling and logging
- Add comments for complex logic
- Use existing utility functions where possible

### Implementation Approach
- Show the full file content when making changes
- Explain what each change does and why
- Test for edge cases and handle errors gracefully
- Consider backward compatibility
- Update relevant type definitions
- Provide clear summaries of changes made

### UI/UX Preferences
- Clean, minimalist design (no unnecessary icons)
- Use existing Tailwind classes and CSS variables
- Maintain consistent styling with existing components
- Focus on functionality over decorative elements
- Clear, descriptive labels and messages

### Project Structure
File paths:
- Frontend: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/
- Backend: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend/
- Always use full absolute paths in commits

## Sample Opening Message for New Chat

```
I'm implementing Slack reply tracking for ClubOS, a golf simulator management system. 

Current setup:
- React/Next.js frontend with TypeScript
- Express backend with PostgreSQL database (on Railway)
- Existing feedback system where users mark AI responses as helpful/not helpful
- Slack integration that sends messages but doesn't track replies

Goal: When someone replies to a ClubOS message in Slack, I want to:
1. Capture that reply and store it as feedback
2. Show it in the Operations page alongside user feedback
3. Notify the original requester in real-time

I have a detailed plan (which I'll share) but need help implementing it with our PostgreSQL database and no current WebSocket setup.

My preferences:
- Provide complete file contents when making changes (no truncation)
- End with a commit script using full paths and descriptive commit messages
- Keep UI clean and minimalist without unnecessary icons
- Follow existing TypeScript patterns in the codebase
- Handle errors gracefully with proper logging

Project paths:
- Frontend: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend/
- Backend: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend/

Should I start with extending the feedback system to support Slack replies, or would you recommend a different approach?
```

## Technical Implementation Details

### Database Schema Changes (PostgreSQL)
```sql
-- Add columns to existing feedback table
ALTER TABLE feedback 
ADD COLUMN feedback_source VARCHAR(50) DEFAULT 'user',
ADD COLUMN slack_thread_ts VARCHAR(255),
ADD COLUMN slack_user_name VARCHAR(255),
ADD COLUMN original_request_id UUID REFERENCES requests(id);

-- Add indexes
CREATE INDEX idx_feedback_source ON feedback(feedback_source);
CREATE INDEX idx_feedback_slack_thread ON feedback(slack_thread_ts);

-- Create new table for tracking Slack messages
CREATE TABLE slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  request_id UUID REFERENCES requests(id),
  slack_thread_ts VARCHAR(255) UNIQUE,
  slack_channel VARCHAR(255),
  original_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slack_messages_user_id ON slack_messages(user_id);
CREATE INDEX idx_slack_messages_thread_ts ON slack_messages(slack_thread_ts);
```

### API Endpoints to Implement
1. `POST /api/slack/events` - Webhook for Slack events
2. `GET /api/feedback/slack-replies` - Get Slack replies
3. `GET /api/notifications/poll` - Polling endpoint for notifications

### Frontend Components to Update
1. Operations page - Add Slack replies section
2. RequestForm - Show real-time notifications
3. Create SlackReplyCard component
4. Add notification polling service

## Additional Notes
- Consider implementing Server-Sent Events (SSE) as an alternative to WebSockets for real-time updates
- Slack Events API requires URL verification - implement challenge response
- Store Slack app credentials in environment variables
- Implement retry logic for Slack API calls
- Add rate limiting for notification polling
- Consider implementing a queue system for processing Slack events

## Environment Variables Needed
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
SLACK_CHANNEL=#clubos-requests
```

---
Last Updated: January 2025
This document should be shared at the start of any new chat about implementing the Slack reply tracking feature.
