#!/bin/bash

# Deploy NinjaOne Integration to Git/Railway/Vercel
# This will trigger automatic deployments

echo "=== Deploying NinjaOne Integration ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Change to project directory
cd "$(dirname "$0")"

# Check git status
echo -e "${YELLOW}Checking git status...${NC}"
git status --short

# Add all changes
echo -e "\n${YELLOW}Adding all changes...${NC}"
git add -A

# Show what will be committed
echo -e "\n${YELLOW}Files to be committed:${NC}"
git status --short

# Create commit message
COMMIT_MSG="feat: Add NinjaOne remote actions integration

- Implemented remote actions API endpoints with demo mode
- Added PowerShell scripts for PC/software control
- Created Remote Actions tab in Commands page
- Added support for TrackMan, Music, TV system controls
- Implemented real-time job status polling
- Added comprehensive error handling and logging
- Created database migration for action history
- Full RBAC integration (operator role required)
- Slack notifications for critical actions
- Demo mode active until credentials configured

Ready for production activation in ~45 minutes once NinjaOne subscription is available."

# Commit changes
echo -e "\n${YELLOW}Committing changes...${NC}"
git commit -m "$COMMIT_MSG"

# Push to origin
echo -e "\n${YELLOW}Pushing to GitHub (this will trigger deployments)...${NC}"
git push origin main

echo -e "\n${GREEN}✅ Deployment initiated!${NC}"
echo ""
echo "Automatic deployments triggered:"
echo "- GitHub → Vercel (Frontend): Usually completes in 1-2 minutes"
echo "- GitHub → Railway (Backend): Usually completes in 2-3 minutes"
echo ""
echo "Monitor deployment status:"
echo "- Vercel: https://vercel.com/dashboard"
echo "- Railway: https://railway.app/dashboard"
echo ""
echo -e "${GREEN}The NinjaOne integration is being deployed!${NC}"