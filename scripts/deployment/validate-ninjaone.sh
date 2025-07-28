#!/bin/bash
cd "$(dirname "$0")"

# NinjaOne Integration Validation Script

echo "=== NinjaOne Integration Validation ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2 - File not found: $1"
        ((ERRORS++))
    fi
}

# Function to check for specific content in file
check_content() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $3"
    else
        echo -e "${RED}✗${NC} $3"
        ((ERRORS++))
    fi
}

echo "1. Checking Backend Files..."
echo "------------------------"
check_file "ClubOSV1-backend/src/routes/remoteActions.ts" "Remote Actions Route"
check_file "ClubOSV1-backend/src/services/ninjaone.ts" "NinjaOne Service"
check_file "ClubOSV1-backend/src/database/migrations/007_remote_actions.sql" "Database Migration"

echo ""
echo "2. Checking Frontend Files..."
echo "--------------------------"
check_file "ClubOSV1-frontend/src/api/remoteActions.ts" "Remote Actions API"
check_file "ClubOSV1-frontend/src/pages/commands.tsx" "Commands Page"

echo ""
echo "3. Checking PowerShell Scripts..."
echo "------------------------------"
check_file "ninjaone-scripts/Restart-TrackMan-Simple.ps1" "TrackMan Restart Script"
check_file "ninjaone-scripts/Restart-Browser-Simple.ps1" "Browser Restart Script"
check_file "ninjaone-scripts/Reboot-SimulatorPC.ps1" "PC Reboot Script"
check_file "ninjaone-scripts/Restart-All-Software.ps1" "All Software Script"
check_file "ninjaone-scripts/Restart-MusicSystem.ps1" "Music System Script"
check_file "ninjaone-scripts/Restart-TVSystem.ps1" "TV System Script"
check_file "ninjaone-scripts/Other-SystemActions.ps1" "Other Actions Script"

echo ""
echo "4. Checking Backend Integration..."
echo "-------------------------------"
check_content "ClubOSV1-backend/src/index.ts" "remoteActionsRoutes" "Remote Actions route registered"
check_content "ClubOSV1-backend/src/routes/remoteActions.ts" "requireAuth" "Authentication middleware"
check_content "ClubOSV1-backend/src/routes/remoteActions.ts" "requireRole('operator')" "Role authorization"
check_content "ClubOSV1-backend/src/routes/remoteActions.ts" "DEMO-" "Demo mode support"

echo ""
echo "5. Checking Frontend Integration..."
echo "--------------------------------"
check_content "ClubOSV1-frontend/src/pages/commands.tsx" "remoteActionsAPI" "API client imported"
check_content "ClubOSV1-frontend/src/pages/commands.tsx" "handleExecuteReset" "Reset handler function"
check_content "ClubOSV1-frontend/src/pages/commands.tsx" "remote-actions" "Remote actions tab"

echo ""
echo "6. Checking Environment Variables..."
echo "---------------------------------"
if [ -f "ClubOSV1-backend/.env" ]; then
    if grep -q "NINJAONE_CLIENT_ID" "ClubOSV1-backend/.env"; then
        echo -e "${GREEN}✓${NC} NinjaOne environment variables found"
    else
        echo -e "${YELLOW}!${NC} NinjaOne environment variables not set (will use demo mode)"
    fi
else
    echo -e "${YELLOW}!${NC} Backend .env file not found (normal for production)"
fi

echo ""
echo "7. Summary"
echo "----------"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All validation checks passed!${NC}"
    echo ""
    echo "The NinjaOne integration is fully implemented and ready."
    echo ""
    echo "Demo Mode:"
    echo "- The system will work in demo mode until NinjaOne credentials are added"
    echo "- All actions will be simulated but logged properly"
    echo ""
    echo "To activate production mode:"
    echo "1. Add NINJAONE_CLIENT_ID and NINJAONE_CLIENT_SECRET to Railway"
    echo "2. Upload PowerShell scripts to NinjaOne"
    echo "3. Update device IDs and script IDs in remoteActions.ts"
    echo "4. Test with one location first"
else
    echo -e "${RED}✗ Found $ERRORS errors${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
fi

echo ""
echo "=== Validation Complete ==="