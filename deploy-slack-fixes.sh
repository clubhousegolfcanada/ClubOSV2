#!/bin/bash

echo "🚀 Deploying all Slack fixes..."

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Add all changes
git add -A

# Commit all fixes
git commit -m "Fix Slack fallback authentication and user data

- Uncomment axios interceptor to add auth token to all requests
- Add authentication middleware to Slack message endpoint
- Fetch complete user data including name and phone for Slack messages
- This ensures Slack fallback works when Smart Assist is disabled"

# Push to deploy
git push origin main

echo "✅ Deployed! The fixes include:"
echo "  - Authentication token is now sent with all requests"
echo "  - Slack endpoint requires authentication"
echo "  - User info (name, email, phone) will appear in Slack messages"
echo ""
echo "After deployment completes (1-2 minutes):"
echo "1. Refresh your browser (Ctrl+Shift+R)"
echo "2. Log in again if needed"
echo "3. Turn Smart Assist OFF"
echo "4. Submit a request"
echo "5. Check #clubos-assistants in Slack"
