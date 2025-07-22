# Slack Integration Setup Guide

This guide will help you set up Slack integration for ClubOS to enable:
- Notifications when tickets are created
- Direct messaging to Slack when "Smart Assist" is disabled
- Test messages to verify connectivity

## Prerequisites

1. A Slack workspace where you have admin permissions
2. Ability to create Slack apps and webhooks

## Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Name your app: `ClubOS Bot`
5. Select your workspace
6. Click "Create App"

## Step 2: Set Up Incoming Webhooks

1. In your Slack app settings, go to "Incoming Webhooks"
2. Toggle "Activate Incoming Webhooks" to ON
3. Click "Add New Webhook to Workspace"
4. Select the channel where you want messages posted (e.g., `#clubos-requests`)
5. Click "Allow"
6. Copy the Webhook URL (it will look like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX`)

## Step 3: Configure ClubOS Backend

1. Open your `.env` file in the backend directory:
   ```
   /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend/.env
   ```

2. Update these environment variables:
   ```env
   # Slack Configuration
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   SLACK_CHANNEL=#clubos-requests
   SLACK_USERNAME=ClubOSV1 Bot
   SLACK_ICON_EMOJI=:golf:
   ```

3. Save the file

## Step 4: (Optional) Set Up Interactive Features

If you want to enable slash commands and interactive components:

1. In your Slack app settings, go to "Basic Information"
2. Find "Signing Secret" and copy it
3. Add to your `.env` file:
   ```env
   SLACK_SIGNING_SECRET=your-signing-secret-here
   ```

4. Set up slash commands:
   - Go to "Slash Commands" in your app settings
   - Create these commands:
     - `/clubos` - Request URL: `https://your-domain.com/api/slack/commands`
     - `/help` - Request URL: `https://your-domain.com/api/slack/commands`

5. Set up event subscriptions (if needed):
   - Go to "Event Subscriptions"
   - Enable events
   - Request URL: `https://your-domain.com/api/slack/webhook`
   - Subscribe to bot events: `message.channels`, `app_mention`

## Step 5: Test the Integration

1. Restart your backend server:
   ```bash
   cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
   npm run dev
   ```

2. Test from the Operations Dashboard:
   - Go to http://localhost:3000/operations
   - In the "Overview" tab, find "Slack Integration"
   - Click "Test Slack"

3. Check your Slack channel for the test message

## What Gets Sent to Slack

### 1. New Ticket Notifications
When a ticket is created, Slack receives:
- Ticket title and description
- Priority level with color coding
- Category (Facilities or Tech)
- Location
- Created by information
- Ticket ID for reference

### 2. Direct Messages (Smart Assist OFF)
When users disable Smart Assist:
- Full request description
- Location information
- Request ID
- Timestamp

### 3. Test Messages
- Connection verification
- Environment information
- Configuration status

## Troubleshooting

### "Slack webhook URL not configured"
- Make sure `SLACK_WEBHOOK_URL` is set in your `.env` file
- Restart the backend server after making changes

### Messages not appearing in Slack
1. Check the webhook URL is correct
2. Verify the channel name matches (including the # symbol)
3. Check backend logs for errors:
   ```bash
   tail -f logs/error.log
   ```

### Test button shows "Slack integration is currently disabled"
- The system config might have Slack disabled
- Go to Operations > Settings
- Enable "Enable Slack Fallback"

## Security Notes

- Keep your webhook URL secret - anyone with it can post to your Slack
- The signing secret is used to verify requests from Slack
- Consider using environment-specific webhooks for dev/staging/production

## Need Help?

If you encounter issues:
1. Check the backend logs
2. Verify all environment variables are set correctly
3. Ensure your Slack app has the necessary permissions
4. Test with the Slack API tester: https://api.slack.com/methods/chat.postMessage/test
