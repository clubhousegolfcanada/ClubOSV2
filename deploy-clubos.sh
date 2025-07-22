#!/bin/bash

# ClubOS Deployment Script

echo "🚀 ClubOS Deployment Script"
echo "=========================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command succeeded
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 successful${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# 1. Git Status Check
echo -e "\n${BLUE}1. Checking Git Status...${NC}"
git status --short

# 2. Add and Commit Changes
if [[ `git status --short` ]]; then
    echo -e "\n${BLUE}2. Committing Changes...${NC}"
    git add .
    read -p "Enter commit message: " commit_msg
    git commit -m "$commit_msg"
    check_status "Git commit"
else
    echo -e "\n${YELLOW}No changes to commit${NC}"
fi

# 3. Push to GitHub
echo -e "\n${BLUE}3. Pushing to GitHub...${NC}"
git push origin main
check_status "GitHub push"

# 4. Deployment Status
echo -e "\n${GREEN}✅ Code pushed successfully!${NC}"
echo -e "\n${BLUE}Automatic Deployments:${NC}"
echo "• Vercel (Frontend): https://club-osv-2-owqx.vercel.app"
echo "  Status: https://vercel.com/clubhousegolfcanada/club-osv-2-owqx"
echo ""
echo "• Railway (Backend): https://clubosv2-production.up.railway.app"
echo "  Status: https://railway.app/dashboard"

# 5. Quick Test Commands
echo -e "\n${BLUE}Quick Test Commands:${NC}"
echo "Test API Health:"
echo "  curl https://clubosv2-production.up.railway.app/health"
echo ""
echo "Test Login (after deployment completes):"
echo "  Visit: https://club-osv-2-owqx.vercel.app"
echo "  Email: admin@clubhouse247golf.com"
echo "  Password: admin123"

# 6. Wait for deployments
echo -e "\n${YELLOW}⏳ Deployments usually take 1-2 minutes${NC}"
echo "Watch deployment progress in your browser"

# Optional: Open deployment pages
read -p "Open deployment dashboards in browser? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open "https://vercel.com/clubhousegolfcanada/club-osv-2-owqx/deployments"
    open "https://railway.app/dashboard"
fi

echo -e "\n${GREEN}🎉 Deployment script completed!${NC}"
