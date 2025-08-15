#!/bin/bash

echo "========================================="
echo "UniFi Door Device Extraction Helper"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}Since the mobile app works, let's get your door info!${NC}"
echo ""

echo -e "${BLUE}Step 1: Get Door Information from Network Console${NC}"
echo "1. Log into: https://unifi.ui.com"
echo "2. Go to your Network console"
echo "3. Click on 'Devices' in the left menu"
echo "4. Look for devices that are:"
echo "   - UniFi Access Hub (UAH)"
echo "   - UniFi Access Lite (UA-Lite)"
echo "   - Any device with 'door' in the name"
echo ""

echo -e "${GREEN}For each door device, note:${NC}"
echo "   - Device Name (e.g., 'Bedford Staff Door')"
echo "   - MAC Address (e.g., 'aa:bb:cc:dd:ee:ff')"
echo "   - IP Address (e.g., '192.168.1.100')"
echo "   - Model (e.g., 'UAH' or 'UA-Lite')"
echo ""

echo -e "${BLUE}Step 2: Add to .env file:${NC}"
echo ""
cat << 'EOF'
# Bedford Door Devices
BEDFORD_MAIN_DOOR_MAC=<mac-address>
BEDFORD_MAIN_DOOR_IP=<ip-address>
BEDFORD_STAFF_DOOR_MAC=<mac-address>
BEDFORD_STAFF_DOOR_IP=<ip-address>

# Dartmouth Door Devices
DARTMOUTH_MAIN_DOOR_MAC=<mac-address>
DARTMOUTH_MAIN_DOOR_IP=<ip-address>
DARTMOUTH_STAFF_DOOR_MAC=<mac-address>
DARTMOUTH_STAFF_DOOR_IP=<ip-address>
DARTMOUTH_BAY_DOOR_MAC=<mac-address>
DARTMOUTH_BAY_DOOR_IP=<ip-address>
EOF

echo ""
echo -e "${BLUE}Step 3: Mobile App Token (Optional)${NC}"
echo "If you want to use the mobile API:"
echo "1. Open UniFi Access app on your phone"
echo "2. Go to Settings"
echo "3. Enable Developer Mode (tap version 7 times)"
echo "4. Go to Developer > Show Token"
echo "5. Add to .env:"
echo "   UNIFI_MOBILE_TOKEN=<token-from-app>"
echo ""

echo -e "${BLUE}Step 4: Tailscale Setup (Recommended)${NC}"
echo "For most reliable connection:"
echo "1. Install Tailscale at each location"
echo "2. Get Tailscale IPs (100.x.x.x)"
echo "3. Add to .env:"
echo "   BEDFORD_CONTROLLER_IP=100.x.x.x"
echo "   DARTMOUTH_CONTROLLER_IP=100.x.x.x"
echo ""

echo -e "${GREEN}Quick Test Commands:${NC}"
echo "# Test with current setup"
echo "npm run test:unifi"
echo ""
echo "# Test Tailscale connection"
echo "npm run test:tailscale"
echo ""
echo "# Test mobile API"
echo "npm run test:mobile-api"
echo ""

echo -e "${YELLOW}Need Help?${NC}"
echo "- Can't find devices? They might be under 'Clients' if not adopted"
echo "- Mobile app works? That confirms the devices exist"
echo "- Tailscale is fastest solution (15 min setup)"
echo ""