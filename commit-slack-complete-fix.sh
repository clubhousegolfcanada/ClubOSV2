#!/bin/bash

echo "🔧 Fixing Slack fallback with complete user data..."

# Add all changes
git add -A

# Commit
git commit -m "Fix Slack fallback - fetch complete user data

- Uncomment axios interceptor to add auth token
- Add authentication middleware to Slack endpoint  
- Fetch complete user data including name and phone
- Ensure Slack messages show full user information"

# Push
git push origin main

echo "✅ Deployed! To test the Slack fallback:"
echo "1. Make sure you're logged in"
echo "2. Toggle Smart Assist OFF"
echo "3. Submit a request"
echo "4. Check Slack for the message with user info"
echo ""
echo "If you still get 401 errors:"
echo "- Clear browser cache and refresh"
echo "- Log out and log back in"
echo "- Check the token in console with: localStorage.getItem('clubos_token')"
