#!/bin/bash

# Commit all recent changes
cd "$(dirname "$0")"

echo "=== Committing Recent Changes ==="
echo ""

# Add all modified files
echo "Adding modified files..."
git add ClubOSV1-backend/src/routes/remoteActions.ts
git add ClubOSV1-frontend/src/components/Navigation.tsx
git add docs/LOGGING_REPORTING_STRATEGY.md
git add docs/QUICK_LOGGING_IMPLEMENTATION.md
git add FIX_BACKEND_DEPLOYMENT.md
git add MOBILE_LOGOUT_FIX.md

# Show what will be committed
echo ""
echo "Files to be committed:"
git status --short

# Create commit
echo ""
echo "Creating commit..."
git commit -m "fix: Backend deployment and mobile UX improvements

Backend fixes:
- Fixed auth middleware imports in remoteActions.ts
- Changed requireAuth/requireRole to authenticate/authorize
- Updated Slack service to use slackFallback
- Fixed TypeScript compilation errors

Mobile improvements:
- Increased mobile menu height for better visibility
- Added logout icon to mobile logout button
- Ensures all menu items accessible on mobile

Documentation:
- Added comprehensive logging/reporting strategy
- Created quick implementation guide for logging
- Documented industry standards for SaaS monitoring"

echo ""
echo "✅ Commit created!"
echo ""
echo "Pushing to GitHub..."
git push origin main

echo ""
echo "🚀 Changes pushed to GitHub!"
echo ""
echo "Deployments will be triggered automatically:"
echo "- Vercel (Frontend): ~1-2 minutes"
echo "- Railway (Backend): ~2-3 minutes"
