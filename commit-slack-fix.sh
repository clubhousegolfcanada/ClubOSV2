#!/bin/bash

echo "🔧 Fixing Slack fallback feature..."

# Add all changes
git add -A

# Commit
git commit -m "Fix Slack fallback feature - restore authentication

- Uncomment axios interceptor to add auth token to all API requests
- Add authentication middleware to Slack message endpoint
- This ensures user information is included in Slack messages
- Fixes the fallback to Slack when Smart Assist is disabled"

# Push
git push origin main

echo "✅ Deployed! The Slack fallback should now work properly:"
echo "  - Authentication token is added to all requests"
echo "  - User information (name, email, phone) will appear in Slack messages"
echo "  - Test by disabling Smart Assist and submitting a request"
