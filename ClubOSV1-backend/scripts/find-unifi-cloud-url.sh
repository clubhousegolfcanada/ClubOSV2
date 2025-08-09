#!/bin/bash

echo "========================================="
echo "UniFi Cloud URL Discovery Tool"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}To find your UniFi Cloud controller URL:${NC}"
echo ""
echo "1. Go to: https://unifi.ui.com"
echo "2. Log in with your Ubiquiti account"
echo "3. Select your controller"
echo "4. Look at the URL - it will be something like:"
echo "   - https://unifi-[id].ui.com"
echo "   - https://[id].unifi.ui.com"
echo "   - https://network.unifi.ui.com/[site-id]"
echo ""

echo -e "${YELLOW}Common UniFi Cloud URL patterns:${NC}"
echo "- https://unifi-protect.ui.com (for Protect)"
echo "- https://unifi-network.ui.com (for Network)"
echo "- https://unifi-access.ui.com (for Access)"
echo "- https://[controller-id].unifi.ui.com"
echo ""

echo -e "${BLUE}For UniFi Access specifically:${NC}"
echo "The URL might be:"
echo "- https://unifi-access.ui.com"
echo "- https://access.ui.com"
echo "- Or your specific controller URL from the dashboard"
echo ""

echo -e "${GREEN}Steps to get the correct URL:${NC}"
echo "1. Log into https://unifi.ui.com with your browser"
echo "2. Navigate to your UniFi Access application"
echo "3. Copy the URL from your browser's address bar"
echo "4. Update .env with that URL"
echo ""

echo "Example .env configuration:"
echo "UNIFI_CONTROLLER_URL=https://[your-controller-id].unifi.ui.com"
echo "or"
echo "UNIFI_CONTROLLER_URL=https://unifi-access.ui.com"
echo ""

echo -e "${YELLOW}Note:${NC} The unifi-access npm package might need:"
echo "- Direct controller URL (not cloud URL)"
echo "- Local controller access via VPN"
echo "- Special API endpoint for cloud access"
echo ""

echo "========================================="
echo "Testing possible UniFi Access URLs..."
echo "========================================="
echo ""

# Test various possible URLs
URLS=(
    "https://unifi-access.ui.com"
    "https://access.ui.com"
    "https://network.unifi.ui.com"
    "https://unifi.ui.com/access"
)

for URL in "${URLS[@]}"; do
    echo -n "Testing $URL... "
    response=$(curl -s -o /dev/null -w "%{http_code}" -I "$URL" 2>/dev/null)
    if [ "$response" == "200" ] || [ "$response" == "302" ] || [ "$response" == "401" ]; then
        echo -e "${GREEN}Reachable (HTTP $response)${NC}"
    else
        echo "Not accessible (HTTP $response)"
    fi
done

echo ""
echo "========================================="
echo "Next Steps:"
echo "========================================="
echo "1. Find your specific controller URL from the UniFi dashboard"
echo "2. Update UNIFI_CONTROLLER_URL in .env"
echo "3. You might need to use:"
echo "   - Your UI account email as username"
echo "   - Your UI account password"
echo "   - Or generate an API key from your UI account"
echo ""