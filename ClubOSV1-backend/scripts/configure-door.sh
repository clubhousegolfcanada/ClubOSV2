#!/bin/bash

echo "========================================="
echo "Configuring Door Device"
echo "========================================="
echo ""

MAC="28:70:4e:80:de:3b"

echo "Door MAC Address: $MAC"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}This appears to be a UniFi Access device!${NC}"
echo ""

echo -e "${BLUE}Which door is this?${NC}"
echo "1. Bedford Main Entrance"
echo "2. Bedford Staff Door"
echo "3. Dartmouth Main Entrance"
echo "4. Dartmouth Staff Door"
echo "5. Dartmouth Bay Access"
echo ""

echo -e "${YELLOW}Add this to your .env file:${NC}"
echo ""

echo "# If this is Dartmouth Staff Door:"
echo "DARTMOUTH_STAFF_DOOR_MAC=$MAC"
echo ""

echo "# If this is Bedford Staff Door:"
echo "BEDFORD_STAFF_DOOR_MAC=$MAC"
echo ""

echo "# If this is Dartmouth Bay Access:"
echo "DARTMOUTH_BAY_DOOR_MAC=$MAC"
echo ""

# Update .env if it exists
if [ -f .env ]; then
    echo -e "${GREEN}Updating .env file...${NC}"
    
    # Check if already exists
    if grep -q "DOOR_MAC=$MAC" .env; then
        echo "This MAC is already configured!"
    else
        echo "# Door device added $(date)" >> .env
        echo "# TODO: Update the key name based on which door this is" >> .env
        echo "TEMP_DOOR_MAC=$MAC" >> .env
        echo -e "${GREEN}Added to .env as TEMP_DOOR_MAC${NC}"
        echo "Please rename TEMP_DOOR_MAC to the correct door name"
    fi
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Identify which door this MAC belongs to"
echo "2. Update the environment variable name accordingly"
echo "3. Find the other door MACs in your Network console"
echo "4. Add all door MACs to .env"
echo ""

echo -e "${GREEN}Other door devices to look for:${NC}"
echo "- Similar MAC prefix (28:70:4e) indicates same manufacturer"
echo "- Look for UniFi Access Hub (UAH) or UniFi Access Lite devices"
echo "- Check device names for 'door' references"
echo ""

echo -e "${YELLOW}Quick test after configuration:${NC}"
echo "npx tsx scripts/test-all-unifi-approaches.ts"