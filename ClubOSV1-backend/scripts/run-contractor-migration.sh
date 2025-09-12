#!/bin/bash

echo "================================================"
echo "Running Contractor Role Migration on Railway"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Railway CLI not found. Please install it first.${NC}"
    echo "Visit: https://docs.railway.app/develop/cli"
    exit 1
fi

echo -e "${YELLOW}Checking Railway connection...${NC}"
railway whoami

if [ $? -ne 0 ]; then
    echo -e "${RED}Not logged in to Railway. Please run 'railway login' first.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Running migration on Railway production database...${NC}"
echo ""

# Run the migration using Railway
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

railway run npx tsx scripts/run-contractor-migration.ts

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}✅ Migration completed successfully!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo "You can now create contractor users through the Operations Center."
    echo ""
else
    echo ""
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}❌ Migration failed!${NC}"
    echo -e "${RED}================================================${NC}"
    echo ""
    echo "Please check the error messages above and try again."
    echo "You may need to run individual SQL commands manually."
    exit 1
fi