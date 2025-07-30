#!/bin/bash
# deploy-ninjaone-integration.sh

echo "=== Deploying NinjaOne Integration ==="
echo "Started at: $(date)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "ClubOSV1-backend" ]; then
    echo -e "${RED}Error: Must run from ClubOSV1 root directory${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Running database migration${NC}"
cd ClubOSV1-backend
if [ -f "src/database/migrations/007_remote_actions.sql" ]; then
    echo "Migration file found. Will be applied on next deployment."
else
    echo -e "${RED}Warning: Migration file not found${NC}"
fi

echo -e "\n${YELLOW}Step 2: Checking backend integration${NC}"
if grep -q "remoteActionsRoutes" src/index.ts; then
    echo -e "${GREEN}✓ Remote actions router integrated${NC}"
else
    echo -e "${RED}✗ Remote actions router not found in index.ts${NC}"
fi

if [ -f "src/routes/remoteActions.ts" ]; then
    echo -e "${GREEN}✓ Remote actions route file exists${NC}"
else
    echo -e "${RED}✗ Remote actions route file missing${NC}"
fi

if [ -f "src/services/ninjaone.ts" ]; then
    echo -e "${GREEN}✓ NinjaOne service exists${NC}"
else
    echo -e "${RED}✗ NinjaOne service missing${NC}"
fi

echo -e "\n${YELLOW}Step 3: Checking frontend integration${NC}"
cd ../ClubOSV1-frontend
if [ -f "src/api/remoteActions.ts" ]; then
    echo -e "${GREEN}✓ Remote actions API client exists${NC}"
else
    echo -e "${RED}✗ Remote actions API client missing${NC}"
fi

echo -e "\n${YELLOW}Step 4: Environment variables needed in Railway${NC}"
echo "Add these to Railway environment:"
echo "  NINJAONE_CLIENT_ID=<your_client_id>"
echo "  NINJAONE_CLIENT_SECRET=<your_client_secret>"
echo "  NINJAONE_BASE_URL=https://api.ninjarmm.com"

echo -e "\n${YELLOW}Step 5: PowerShell scripts for NinjaOne${NC}"
cd ..
if [ -d "ninjaone-scripts" ]; then
    echo "Scripts ready for upload to NinjaOne:"
    ls -1 ninjaone-scripts/*.ps1 | while read script; do
        echo "  - $(basename $script)"
    done
else
    echo -e "${RED}PowerShell scripts directory not found${NC}"
fi

echo -e "\n${YELLOW}Step 6: Git status${NC}"
git status --short

echo -e "\n${GREEN}=== Pre-deployment checklist ===${NC}"
echo "1. [ ] Add NinjaOne credentials to Railway"
echo "2. [ ] Upload PowerShell scripts to NinjaOne library"
echo "3. [ ] Map device IDs in remoteActions.ts"
echo "4. [ ] Map script IDs in remoteActions.ts"
echo "5. [ ] Test with one location first (Bedford recommended)"
echo "6. [ ] Commit and push changes to deploy"

echo -e "\n${YELLOW}Ready to deploy?${NC}"
echo "Run: git add -A && git commit -m 'feat: integrate NinjaOne remote actions' && git push origin main"

echo -e "\n${GREEN}Deployment preparation complete!${NC}"
echo "Completed at: $(date)"
