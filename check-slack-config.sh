#!/bin/bash

echo "📝 Update Slack Webhook URL"
echo ""
echo "Current webhook configuration:"
echo "=============================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Check current config
if [ -f .env ]; then
    grep SLACK .env || echo "No Slack configuration found"
else
    echo ".env file not found"
fi

echo ""
echo "To fix the Slack integration:"
echo "1. Go to https://api.slack.com/apps"
echo "2. Select your app or create 'ClubOS Bot'"
echo "3. Go to 'Incoming Webhooks' and activate it"
echo "4. Click 'Add New Webhook to Workspace'"
echo "5. Choose channel: #clubos-requests"
echo "6. Copy the webhook URL"
echo ""
echo "Then update your .env file with:"
echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
echo "SLACK_CHANNEL=#clubos-requests"
echo ""
echo "After updating, restart the backend:"
echo "npm run dev"
