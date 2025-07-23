#!/bin/bash

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🚨 Emergency fix - Disabling auth on Slack/Feedback"
echo "=================================================="

git add -A
git commit -m "fix: EMERGENCY - Disable auth on Slack and Feedback endpoints

- Frontend axios interceptor not sending Authorization header
- Temporarily disabled auth middleware on /api/slack/message
- Temporarily disabled auth middleware on /api/feedback
- Added default user for unauthenticated requests
- This is TEMPORARY until frontend is fixed"

git push origin main

echo "✅ Pushed!"
echo "========="
echo "Wait 2-3 minutes for Railway to deploy"
echo "Then Send to Slack and Feedback will work"
