# Slack Two-Way Communication Setup

## Current Status
- ✅ Receiving replies from Slack to ClubOS works (via polling)
- ❌ Sending replies from ClubOS to Slack requires a real Slack Bot Token

## The Problem
Railway currently has a **placeholder** bot token (`xoxb-placeholder-token`) which doesn't work. The system detects this and falls back to webhook-only mode, which creates fake thread IDs like `thread_1234567890_abc123` that can't be used for replies.

**You're seeing the error because the bot token is a placeholder, not a real token.**

## How to Enable Two-Way Communication

### Step 1: Create a Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it "ClubOS" and select your workspace

### Step 2: Configure Bot Token Scopes
1. Go to "OAuth & Permissions" in the sidebar
2. Under "Scopes" → "Bot Token Scopes", add:
   - `chat:write` - Send messages
   - `channels:read` - List channels
   - `channels:history` - Read channel messages
   - `groups:read` - List private channels (if needed)
   - `groups:history` - Read private channel messages (if needed)

### Step 3: Install App to Workspace
1. Go to "OAuth & Permissions"
2. Click "Install to Workspace"
3. Authorize the app
4. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### Step 4: Add Bot to Channel
1. In Slack, go to the channel where ClubOS sends messages (#clubos-assistants)
2. Type `/invite @ClubOS` (or your app name)

### Step 5: Configure Railway Environment Variables
Add these to your Railway backend service:
```
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_CHANNEL_ID=C1234567890  # Optional but recommended
```

To get the channel ID:
1. Right-click the channel in Slack
2. Select "View channel details"
3. At the bottom, you'll see the Channel ID

### Step 6: Restart the Service
After adding the environment variables, Railway will automatically restart the service.

## Testing
1. Send a message with Smart Assist OFF
2. You should now see a real thread timestamp in the logs (like `1234567890.123456`)
3. The reply input field will appear
4. Replies from ClubOS will show in the Slack thread

## Troubleshooting

### "Two-way replies require Slack Bot Token configuration"
This means the bot token is not set in Railway environment variables.

### "Cannot reply to webhook-generated thread"
This means the message was sent using the old webhook method. New messages sent after configuring the bot token will work.

### 500 Error when sending reply
Check Railway logs - likely the bot token is invalid or doesn't have proper permissions.

## Benefits of Full Slack API Integration
- ✅ Two-way conversation threads
- ✅ Real thread timestamps
- ✅ Better message formatting options
- ✅ Ability to update/delete messages
- ✅ User information in messages