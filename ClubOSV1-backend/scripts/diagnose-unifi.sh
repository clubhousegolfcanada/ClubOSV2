#!/bin/bash

echo "========================================="
echo "UniFi Access Controller Diagnostic Tool"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Current Network Configuration:${NC}"
echo "Your machine is on network: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}')"
echo ""

echo -e "${BLUE}Checking configured UniFi controller:${NC}"
CONTROLLER_URL=$(grep "UNIFI_CONTROLLER_URL=" .env | cut -d'=' -f2)
CONTROLLER_PORT=$(grep "UNIFI_CONTROLLER_PORT=" .env | cut -d'=' -f2)
echo "URL: $CONTROLLER_URL"
echo "Port: $CONTROLLER_PORT"
echo ""

# Extract hostname/IP from URL
CONTROLLER_HOST=$(echo $CONTROLLER_URL | sed 's|https\?://||' | cut -d':' -f1 | cut -d'/' -f1)

echo -e "${BLUE}Testing connectivity to $CONTROLLER_HOST:${NC}"
ping -c 2 -W 2 $CONTROLLER_HOST > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Host is reachable via ping${NC}"
else
    echo -e "${RED}✗ Host is NOT reachable via ping${NC}"
    echo "  This could mean:"
    echo "  1. Wrong IP address"
    echo "  2. Firewall blocking ICMP"
    echo "  3. Controller is on different network"
fi
echo ""

# Try common UniFi controller addresses
echo -e "${BLUE}Scanning for UniFi controllers on local network:${NC}"
echo "Checking common addresses..."

# Get current subnet
SUBNET=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d'.' -f1-3)

# Common UniFi addresses to check
COMMON_IPS=(
    "${SUBNET}.1"
    "${SUBNET}.2"
    "${SUBNET}.254"
    "192.168.1.1"
    "192.168.0.1"
    "unifi"
    "unifi.local"
)

for IP in "${COMMON_IPS[@]}"; do
    echo -n "Checking $IP... "
    
    # Try HTTPS on port 443
    timeout 2 curl -k -s https://$IP:443 > /dev/null 2>&1
    if [ $? -eq 0 ] || [ $? -eq 60 ]; then
        echo -e "${GREEN}Possible UniFi at https://$IP:443${NC}"
        FOUND_CONTROLLERS+=("https://$IP:443")
    else
        # Try HTTPS on port 8443
        timeout 2 curl -k -s https://$IP:8443 > /dev/null 2>&1
        if [ $? -eq 0 ] || [ $? -eq 60 ]; then
            echo -e "${GREEN}Possible UniFi at https://$IP:8443${NC}"
            FOUND_CONTROLLERS+=("https://$IP:8443")
        else
            echo "Not found"
        fi
    fi
done
echo ""

# Check if UniFi is installed locally
echo -e "${BLUE}Checking for local UniFi installation:${NC}"
if [ -d "/Applications/UniFi.app" ] || [ -d "/Applications/UniFi Access.app" ]; then
    echo -e "${GREEN}✓ UniFi application found locally${NC}"
    echo "  Try: https://localhost:8443 or https://127.0.0.1:8443"
else
    echo "No local UniFi installation found"
fi
echo ""

# Recommendations
echo -e "${BLUE}Recommendations:${NC}"
if [ ${#FOUND_CONTROLLERS[@]} -gt 0 ]; then
    echo -e "${GREEN}Found possible UniFi controllers:${NC}"
    for CONTROLLER in "${FOUND_CONTROLLERS[@]}"; do
        echo "  - $CONTROLLER"
    done
    echo ""
    echo "To test a different URL:"
    echo "1. Edit .env file and update UNIFI_CONTROLLER_URL"
    echo "2. Run: npm run test:unifi"
else
    echo -e "${YELLOW}No UniFi controllers detected on network.${NC}"
    echo ""
    echo "Possible solutions:"
    echo "1. Check if UniFi controller is running"
    echo "2. Verify you're on the same network as the controller"
    echo "3. Check firewall settings"
    echo "4. Try connecting via VPN if controller is remote"
    echo "5. Use the controller's hostname instead of IP"
fi
echo ""

echo "Common UniFi Access URLs:"
echo "  - https://unifi.yourdomain.com"
echo "  - https://192.168.x.x:8443"
echo "  - https://localhost:8443 (if local)"
echo ""

# Test current configuration with curl
echo -e "${BLUE}Testing current configuration with curl:${NC}"
echo "Attempting: $CONTROLLER_URL"
curl -k -I -m 5 "$CONTROLLER_URL" 2>&1 | head -n 20
echo ""

echo "========================================="
echo "Diagnostic Complete"
echo "========================================="