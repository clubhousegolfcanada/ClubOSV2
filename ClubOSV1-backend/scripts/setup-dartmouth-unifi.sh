#!/bin/bash

echo "========================================="
echo "UniFi Cloud Setup for Dartmouth"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Dartmouth Console ID
CONSOLE_ID="0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302"

echo -e "${GREEN}✅ Dartmouth Console ID:${NC}"
echo "   $CONSOLE_ID"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
fi

echo -e "${BLUE}Setting up UniFi Cloud Access for Dartmouth...${NC}"
echo ""

# Function to update or add env variable
update_env() {
    local key=$1
    local value=$2
    if grep -q "^$key=" .env; then
        # Update existing
        sed -i.bak "s|^$key=.*|$key=$value|" .env
    else
        # Add new
        echo "$key=$value" >> .env
    fi
}

# Set the console ID
update_env "UNIFI_CONSOLE_ID" "$CONSOLE_ID"

echo -e "${GREEN}✅ Console ID configured${NC}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Add your Ubiquiti account credentials to .env:"
echo "   UNIFI_CLOUD_USERNAME=your-email@example.com"
echo "   UNIFI_CLOUD_PASSWORD=your-password"
echo ""
echo "2. Get the actual door IDs from UniFi Access:"
echo "   a. Go to: https://unifi.ui.com/consoles/$CONSOLE_ID/access/doors"
echo "   b. Click on each door to find its ID"
echo "   c. Add to .env:"
echo "      DARTMOUTH_MAIN_DOOR_ID=<actual-id>"
echo "      DARTMOUTH_STAFF_DOOR_ID=<actual-id>"
echo "      DARTMOUTH_BAY_DOOR_ID=<actual-id>"
echo "      DARTMOUTH_EMERGENCY_DOOR_ID=<actual-id>"
echo ""
echo "3. Test the connection:"
echo "   npm run test:unifi-cloud"
echo ""
echo -e "${BLUE}Direct link to your Dartmouth UniFi Access:${NC}"
echo "https://unifi.ui.com/consoles/$CONSOLE_ID/access/dashboard"
echo ""
echo -e "${GREEN}Setup script complete!${NC}"