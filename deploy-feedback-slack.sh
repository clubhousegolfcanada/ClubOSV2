#!/bin/bash

echo "🚀 Deploying unhelpful feedback Slack notifications..."

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Add all changes
git add -A

# Commit
git commit -m "Add Slack notifications for unhelpful feedback and remove all emojis

- Send red-colored Slack alert when users mark responses as not helpful
- Include the original request, AI response, route, and confidence
- Remove all emojis from Slack messages (phone, ticket, etc.)
- Clean professional formatting throughout"

# Push to deploy
git push origin main

echo "✅ Deployed! Changes include:"
echo "  - Unhelpful feedback now sends RED alerts to Slack"
echo "  - All emojis removed from Slack messages"
echo "  - Professional text-only formatting"
echo ""
echo "Test by:"
echo "1. Submit a request with Smart Assist ON"
echo "2. Click 'Not Useful' on the response"
echo "3. Check #clubos-assistants for the red alert"
