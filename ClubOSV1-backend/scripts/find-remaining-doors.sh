#!/bin/bash

echo "========================================="
echo "Door Configuration Progress"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}✅ Configured Doors:${NC}"
echo "   • Dartmouth Staff Door: 28:70:4e:80:de:3b"
echo ""

echo -e "${YELLOW}🔍 Doors Still Needed:${NC}"
echo "   • Bedford Main Entrance"
echo "   • Bedford Staff Door"
echo "   • Dartmouth Main Entrance"
echo "   • Dartmouth Bay Access"
echo ""

echo -e "${BLUE}Tips for Finding Remaining Doors:${NC}"
echo ""
echo "1. Look for similar MAC addresses:"
echo "   - Starting with 28:70:4e (same manufacturer)"
echo "   - UniFi Access devices typically have sequential MACs"
echo "   - Try: 28:70:4e:80:de:3a, 28:70:4e:80:de:3c, etc."
echo ""

echo "2. In your UniFi Network Console:"
echo "   - Go to: https://unifi.ui.com/consoles/0CEA1424DB29000000000861C4610000000008D3E6AB000000006703125C:145557302/network/default/devices"
echo "   - Look for device types: UAH, UA-Lite"
echo "   - Check device names for 'door', 'entrance', 'bay'"
echo ""

echo "3. Quick Search Methods:"
echo "   - Use the search box in UniFi console"
echo "   - Filter by 'Offline' devices (doors might be offline)"
echo "   - Check 'Clients' section if not in 'Devices'"
echo ""

echo -e "${GREEN}Once You Find Each Door:${NC}"
echo ""
echo "Add to your .env file:"
echo ""
cat << 'EOF'
# Bedford Doors
BEDFORD_MAIN_DOOR_MAC=<mac-address>
BEDFORD_STAFF_DOOR_MAC=<mac-address>

# Dartmouth Doors
DARTMOUTH_MAIN_DOOR_MAC=<mac-address>
DARTMOUTH_STAFF_DOOR_MAC=28:70:4e:80:de:3b  ✓
DARTMOUTH_BAY_DOOR_MAC=<mac-address>
EOF

echo ""
echo -e "${YELLOW}Testing Your Progress:${NC}"
echo ""
echo "Run this command to test what's configured:"
echo "npx tsx scripts/test-all-unifi-approaches.ts"
echo ""

echo -e "${BLUE}Need the Mobile App Token Too?${NC}"
echo "1. Open UniFi Access app"
echo "2. Settings → Tap version 7 times"
echo "3. Developer → Show Token"
echo "4. Add: UNIFI_MOBILE_TOKEN=<token>"
echo ""

echo "You're making great progress! Just need 4 more door MACs."