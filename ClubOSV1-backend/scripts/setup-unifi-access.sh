#!/bin/bash

# UniFi Access Setup Script for ClubOS
# This script helps configure UniFi Access environment variables

echo "==================================="
echo "ClubOS UniFi Access Setup"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please ensure you're in the ClubOSV1-backend directory"
    exit 1
fi

# Backup existing .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓ Created backup of .env file${NC}"
echo ""

echo "This script will help you configure UniFi Access for door control."
echo "You'll need:"
echo "  1. Your UniFi Controller URL (e.g., https://192.168.1.100 or unifi.yourdomain.com)"
echo "  2. UniFi username and password"
echo "  3. Door MAC addresses from your UniFi Access console"
echo ""
echo "Press Enter to continue or Ctrl+C to exit..."
read

# Function to update .env file
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" .env; then
        # Key exists, update it
        sed -i.bak "s|^${key}=.*|${key}=${value}|" .env
    else
        # Key doesn't exist, add it
        echo "${key}=${value}" >> .env
    fi
}

# Get UniFi Controller details
echo ""
echo "=== UniFi Controller Configuration ==="
echo ""

echo -n "Enter UniFi Controller URL (e.g., https://192.168.1.100): "
read CONTROLLER_URL
update_env "UNIFI_CONTROLLER_URL" "$CONTROLLER_URL"

echo -n "Enter UniFi Controller Port (default 8443): "
read CONTROLLER_PORT
CONTROLLER_PORT=${CONTROLLER_PORT:-8443}
update_env "UNIFI_CONTROLLER_PORT" "$CONTROLLER_PORT"

echo -n "Enter UniFi Username: "
read USERNAME
update_env "UNIFI_USERNAME" "$USERNAME"

echo -n "Enter UniFi Password: "
read -s PASSWORD
echo ""
update_env "UNIFI_PASSWORD" "$PASSWORD"

echo -n "Enter UniFi Site ID (default: 'default'): "
read SITE_ID
SITE_ID=${SITE_ID:-default}
update_env "UNIFI_SITE_ID" "$SITE_ID"

echo ""
echo -e "${GREEN}✓ UniFi Controller configuration saved${NC}"
echo ""

# Configure door IDs
echo "=== Door Configuration ==="
echo ""
echo "Now we'll configure door IDs for each location."
echo "You can find these MAC addresses in your UniFi Access console."
echo "Leave blank if a door doesn't exist at that location."
echo ""

# Function to configure doors for a location
configure_location_doors() {
    local location=$1
    local prefix=$2
    
    echo ""
    echo "--- $location Doors ---"
    
    echo -n "Main Entrance Door MAC (or leave blank): "
    read DOOR_ID
    update_env "${prefix}_MAIN_DOOR_ID" "$DOOR_ID"
    
    echo -n "Staff Door MAC (or leave blank): "
    read DOOR_ID
    update_env "${prefix}_STAFF_DOOR_ID" "$DOOR_ID"
    
    if [ "$location" == "Dartmouth" ]; then
        echo -n "Bay Access Door MAC (or leave blank): "
        read DOOR_ID
        update_env "${prefix}_BAY_DOOR_ID" "$DOOR_ID"
    fi
    
    if [ "$location" == "Bayers Lake" ]; then
        echo -n "Loading Door MAC (or leave blank): "
        read DOOR_ID
        update_env "${prefix}_LOADING_DOOR_ID" "$DOOR_ID"
    fi
    
    echo -n "Emergency Exit Door MAC (or leave blank): "
    read DOOR_ID
    update_env "${prefix}_EMERGENCY_DOOR_ID" "$DOOR_ID"
}

# Ask which locations to configure
echo "Which locations would you like to configure?"
echo "1) Bedford only"
echo "2) Dartmouth only"
echo "3) Both Bedford and Dartmouth"
echo "4) All locations"
echo "5) Skip door configuration (use demo mode)"
echo ""
echo -n "Enter your choice (1-5): "
read LOCATION_CHOICE

case $LOCATION_CHOICE in
    1)
        configure_location_doors "Bedford" "BEDFORD"
        ;;
    2)
        configure_location_doors "Dartmouth" "DARTMOUTH"
        ;;
    3)
        configure_location_doors "Bedford" "BEDFORD"
        configure_location_doors "Dartmouth" "DARTMOUTH"
        ;;
    4)
        configure_location_doors "Bedford" "BEDFORD"
        configure_location_doors "Dartmouth" "DARTMOUTH"
        configure_location_doors "Stratford" "STRATFORD"
        configure_location_doors "Bayers Lake" "BAYERS"
        configure_location_doors "Truro" "TRURO"
        ;;
    5)
        echo ""
        echo -e "${YELLOW}Skipping door configuration - system will run in demo mode${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        ;;
esac

# Configure unlock durations
echo ""
echo "=== Unlock Duration Settings ==="
echo ""

echo -n "Default unlock duration in seconds (default 30): "
read DEFAULT_DURATION
DEFAULT_DURATION=${DEFAULT_DURATION:-30}
update_env "DEFAULT_UNLOCK_DURATION" "$DEFAULT_DURATION"

echo -n "Maximum unlock duration in seconds (default 300): "
read MAX_DURATION
MAX_DURATION=${MAX_DURATION:-300}
update_env "MAX_UNLOCK_DURATION" "$MAX_DURATION"

echo -n "Emergency unlock duration in seconds (default 60): "
read EMERGENCY_DURATION
EMERGENCY_DURATION=${EMERGENCY_DURATION:-60}
update_env "EMERGENCY_UNLOCK_DURATION" "$EMERGENCY_DURATION"

echo ""
echo "==================================="
echo -e "${GREEN}✓ UniFi Access configuration complete!${NC}"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Restart the backend server to apply changes"
echo "2. Check the Remote Actions bar in the UI"
echo "3. Test door unlock functionality"
echo ""
echo "If you see '[DEMO]' prefix on door actions, it means:"
echo "  - UniFi credentials are not configured, OR"
echo "  - Cannot connect to UniFi controller"
echo ""
echo "Your .env backup was saved with timestamp"
echo ""