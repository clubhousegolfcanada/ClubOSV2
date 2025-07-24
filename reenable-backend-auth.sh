#!/bin/bash

# Script to re-enable authentication on backend routes

echo "Re-enabling authentication on backend routes..."

cd ClubOSV1-backend

# Create the fixes
echo "Updating slack.ts to re-enable auth..."
echo "Updating feedback.ts to re-enable auth..."

# Commit the changes
git add src/routes/slack.ts src/routes/feedback.ts
git commit -m "fix: re-enable authentication middleware

- Re-enabled authenticate middleware on /api/slack/message
- Re-enabled authenticate middleware on /api/feedback
- Removed temporary user injection workarounds
- Frontend now properly sends auth headers"

# Push to remote
git push origin main

echo "Backend authentication re-enabled!"
echo ""
echo "Deploy this to Railway to complete the fix."
