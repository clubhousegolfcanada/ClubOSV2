#!/bin/bash

echo "🔧 Setting up Slack Webhook"
echo ""

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    touch .env
fi

echo "Please follow these steps:"
echo "========================="
echo ""
echo "1. Go to: https://api.slack.com/apps"
echo "2. Click 'Create New App' > 'From scratch'"
echo "3. App Name: 'ClubOS Bot'"
echo "4. Workspace: Select your workspace"
echo "5. Click 'Create App'"
echo ""
echo "6. In the app settings, click 'Incoming Webhooks'"
echo "7. Toggle 'Activate Incoming Webhooks' to ON"
echo "8. Click 'Add New Webhook to Workspace'"
echo "9. Select channel: #clubos-requests (or #general)"
echo "10. Click 'Allow'"
echo "11. Copy the Webhook URL (starts with https://hooks.slack.com/services/...)"
echo ""
echo "Enter your Slack Webhook URL:"
read -r WEBHOOK_URL

# Add to .env if not already there
if grep -q "SLACK_WEBHOOK_URL" .env; then
    # Update existing
    sed -i.bak "s|SLACK_WEBHOOK_URL=.*|SLACK_WEBHOOK_URL=$WEBHOOK_URL|" .env
else
    # Add new
    echo "" >> .env
    echo "# Slack Configuration" >> .env
    echo "SLACK_WEBHOOK_URL=$WEBHOOK_URL" >> .env
fi

# Add channel if not exists
if ! grep -q "SLACK_CHANNEL" .env; then
    echo "SLACK_CHANNEL=#clubos-requests" >> .env
fi

echo ""
echo "✅ Slack webhook configured!"
echo ""
echo "Configuration added to .env:"
echo "============================"
grep SLACK .env
echo ""
echo "Now restart your backend:"
echo "cd ClubOSV1-backend"
echo "npm run dev"
