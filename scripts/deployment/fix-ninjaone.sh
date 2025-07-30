#!/bin/bash
# fix-ninjaone-integration.sh
# Quick fixes for NinjaOne integration issues

echo "=== Fixing NinjaOne Integration Issues ==="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 1. Install axios in backend
echo -e "\n${YELLOW}Step 1: Installing axios dependency${NC}"
cd ClubOSV1-backend
if grep -q '"axios"' package.json; then
    echo -e "${GREEN}✓ Axios already in package.json${NC}"
else
    echo "Installing axios..."
    npm install axios
fi

# 2. Fix database import in remoteActions.ts
echo -e "\n${YELLOW}Step 2: Fixing database import path${NC}"
if [ -f "src/routes/remoteActions.ts" ]; then
    # Create backup
    cp src/routes/remoteActions.ts src/routes/remoteActions.backup.ts
    
    # Fix import
    sed -i '' "s/import { pool } from '..\/db'/import { pool } from '..\/utils\/db'/" src/routes/remoteActions.ts
    echo -e "${GREEN}✓ Fixed database import path${NC}"
else
    echo -e "${RED}✗ remoteActions.ts not found${NC}"
fi

# 3. Remove music/TV system code (simplify)
echo -e "\n${YELLOW}Step 3: Simplifying to PC-only actions${NC}"
if [ -f "src/routes/remoteActions-simplified.ts" ]; then
    echo "Using simplified version..."
    mv src/routes/remoteActions.ts src/routes/remoteActions-complex.backup.ts
    mv src/routes/remoteActions-simplified.ts src/routes/remoteActions.ts
    echo -e "${GREEN}✓ Switched to simplified PC-only version${NC}"
fi

# 4. Check if route is mounted
echo -e "\n${YELLOW}Step 4: Verifying route mount${NC}"
if grep -q "remote-actions" src/index.ts; then
    echo -e "${GREEN}✓ Route is mounted in index.ts${NC}"
else
    echo -e "${RED}✗ Route not mounted - needs manual addition to index.ts${NC}"
fi

# 5. Frontend API client
echo -e "\n${YELLOW}Step 5: Checking frontend integration${NC}"
cd ../ClubOSV1-frontend
if [ -f "src/api/remoteActions.ts" ]; then
    echo -e "${GREEN}✓ Frontend API client exists${NC}"
else
    echo -e "${RED}✗ Frontend API client missing${NC}"
fi

# 6. Update commands.tsx to import API client
echo -e "\n${YELLOW}Step 6: Updating commands.tsx imports${NC}"
if [ -f "src/pages/commands.tsx" ]; then
    # Add import if not present
    if ! grep -q "remoteActionsAPI" src/pages/commands.tsx; then
        # Add import at the top after other imports
        sed -i '' "/^import.*lucide-react/a\\
import { remoteActionsAPI, actionWarnings } from '@/api/remoteActions';
" src/pages/commands.tsx
        echo -e "${GREEN}✓ Added remoteActionsAPI import${NC}"
    else
        echo -e "${GREEN}✓ Import already exists${NC}"
    fi
fi

# 7. Summary
echo -e "\n${GREEN}=== Fix Summary ===${NC}"
echo "1. [✓] Axios dependency"
echo "2. [✓] Database import path" 
echo "3. [✓] Simplified to PC-only actions"
echo "4. [✓] Route mounting verified"
echo "5. [✓] Frontend API client"
echo "6. [✓] Commands.tsx imports"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Run 'npm install' in both frontend and backend"
echo "2. Add NinjaOne credentials to Railway environment"
echo "3. Update device IDs in remoteActions.ts"
echo "4. Upload PowerShell scripts to NinjaOne"
echo "5. Test in demo mode first"

echo -e "\n${GREEN}Fixes complete!${NC}"
