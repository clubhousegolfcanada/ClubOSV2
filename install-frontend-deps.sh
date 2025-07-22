#!/bin/bash

# Install Frontend Dependencies Script

echo "📦 Installing ClubOSV1 Frontend Dependencies"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to frontend directory
FRONTEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend"

echo -e "\n${YELLOW}Navigating to frontend directory...${NC}"
cd "$FRONTEND_DIR"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed! Please install Node.js first.${NC}"
    echo "Visit https://nodejs.org/ or run: brew install node"
    exit 1
fi

echo -e "${GREEN}✓ npm is installed${NC}"

# Install dependencies
echo -e "\n${YELLOW}Installing frontend dependencies...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Frontend dependencies installed successfully!${NC}"
    echo -e "\n${YELLOW}You can now run the frontend with:${NC}"
    echo "  npm run dev"
    echo -e "\n${YELLOW}Or use the quick-start script:${NC}"
    echo "  cd /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"
    echo "  ./quick-start.sh"
else
    echo -e "\n${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
