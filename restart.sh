#!/bin/bash

# ClubOS Quick Restart Script
# This script kills existing processes and provides commands to start servers

echo "🔄 ClubOS Quick Restart"
echo "======================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Kill existing processes
echo -e "${RED}Stopping any existing servers...${NC}"

# Kill backend on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✓ Killed process on port 3001${NC}" || echo -e "${BLUE}ℹ No process on port 3001${NC}"

# Kill frontend on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo -e "${GREEN}✓ Killed process on port 3000${NC}" || echo -e "${BLUE}ℹ No process on port 3000${NC}"

echo -e "\n${GREEN}All processes stopped!${NC}"
echo -e "\n${YELLOW}To start the servers, open two terminal windows:${NC}"
echo -e "\n${BLUE}Terminal 1 (Backend):${NC}"
echo "cd \"$(dirname "$0")/ClubOSV1-backend\""
echo "npm run dev"
echo -e "\n${BLUE}Terminal 2 (Frontend):${NC}"
echo "cd \"$(dirname "$0")/ClubOSV1-frontend\""
echo "npm run dev"
echo -e "\n${GREEN}Or run ./start-dev.sh to start both in one terminal${NC}"
