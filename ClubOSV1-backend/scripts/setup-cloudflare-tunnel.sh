#!/bin/bash

# Cloudflare Tunnel Setup Script for UniFi Access Integration
# This script helps set up Cloudflare tunnels at each location

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
}

# Check if cloudflared is installed
check_cloudflared() {
    if ! command -v cloudflared &> /dev/null; then
        print_error "cloudflared is not installed"
        echo "Please install cloudflared first:"
        echo ""
        echo "macOS/Linux:"
        echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared"
        echo "  chmod +x cloudflared"
        echo "  sudo mv cloudflared /usr/local/bin/"
        echo ""
        echo "Or with Homebrew (macOS):"
        echo "  brew install cloudflared"
        exit 1
    fi
    print_success "cloudflared is installed: $(cloudflared --version)"
}

# Login to Cloudflare
cloudflare_login() {
    print_header "Step 1: Cloudflare Authentication"
    
    print_info "Logging into Cloudflare..."
    cloudflared tunnel login
    
    if [ $? -eq 0 ]; then
        print_success "Successfully authenticated with Cloudflare"
    else
        print_error "Failed to authenticate with Cloudflare"
        exit 1
    fi
}

# Create tunnel for a location
create_tunnel() {
    local location=$1
    local tunnel_name="clubos-${location}-unifi"
    
    print_info "Creating tunnel for ${location}..."
    
    # Check if tunnel already exists
    if cloudflared tunnel list | grep -q "$tunnel_name"; then
        print_warning "Tunnel '$tunnel_name' already exists"
        read -p "Do you want to delete and recreate it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cloudflared tunnel delete "$tunnel_name" -f
            print_success "Deleted existing tunnel"
        else
            return
        fi
    fi
    
    # Create new tunnel
    cloudflared tunnel create "$tunnel_name"
    
    if [ $? -eq 0 ]; then
        print_success "Created tunnel: $tunnel_name"
        
        # Get tunnel ID
        TUNNEL_ID=$(cloudflared tunnel list | grep "$tunnel_name" | awk '{print $1}')
        echo "Tunnel ID: $TUNNEL_ID"
        
        # Save tunnel ID to file
        echo "$TUNNEL_ID" > ".tunnel-${location}.id"
    else
        print_error "Failed to create tunnel for ${location}"
        return 1
    fi
}

# Create configuration file for a location
create_config() {
    local location=$1
    local tunnel_id=$2
    local config_file="config-${location}.yml"
    
    print_info "Creating configuration for ${location}..."
    
    cat > "$config_file" << EOF
tunnel: ${tunnel_id}
credentials-file: ${HOME}/.cloudflared/${tunnel_id}.json

ingress:
  # UniFi Access Controller
  - hostname: ${location}-unifi.clubos.internal
    service: https://localhost:12445
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      httpHostHeader: localhost
      
  # UniFi Network Controller (optional)
  - hostname: ${location}-network.clubos.internal
    service: https://localhost:8443
    originRequest:
      noTLSVerify: true
      
  # Health check endpoint
  - hostname: ${location}-health.clubos.internal
    service: http://localhost:8080
    
  # Catch-all rule (must be last)
  - service: http_status:404
EOF
    
    print_success "Created configuration file: $config_file"
    echo ""
    echo "Configuration preview:"
    cat "$config_file"
}

# Setup DNS routing
setup_dns() {
    local location=$1
    local tunnel_id=$2
    
    print_info "Setting up DNS for ${location}..."
    
    # Route multiple hostnames to the tunnel
    cloudflared tunnel route dns "$tunnel_id" "${location}-unifi.clubos.internal"
    cloudflared tunnel route dns "$tunnel_id" "${location}-network.clubos.internal"
    cloudflared tunnel route dns "$tunnel_id" "${location}-health.clubos.internal"
    
    print_success "DNS routing configured for ${location}"
}

# Create systemd service (Linux) or launchd plist (macOS)
create_service() {
    local location=$1
    local tunnel_id=$2
    
    print_info "Creating service for ${location}..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux systemd service
        SERVICE_FILE="/etc/systemd/system/cloudflared-${location}.service"
        
        sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Cloudflare Tunnel for ${location} UniFi Access
After=network.target

[Service]
Type=simple
User=cloudflared
Group=cloudflared
ExecStart=/usr/local/bin/cloudflared tunnel run --config /etc/cloudflared/config-${location}.yml ${tunnel_id}
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
        
        # Copy config to system location
        sudo mkdir -p /etc/cloudflared
        sudo cp "config-${location}.yml" /etc/cloudflared/
        
        # Enable and start service
        sudo systemctl daemon-reload
        sudo systemctl enable "cloudflared-${location}"
        
        print_success "Created systemd service: cloudflared-${location}"
        echo "Start with: sudo systemctl start cloudflared-${location}"
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS launchd plist
        PLIST_FILE="${HOME}/Library/LaunchAgents/com.cloudflare.${location}.plist"
        
        tee "$PLIST_FILE" > /dev/null << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflare.${location}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/cloudflared</string>
        <string>tunnel</string>
        <string>run</string>
        <string>--config</string>
        <string>${PWD}/config-${location}.yml</string>
        <string>${tunnel_id}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/cloudflared-${location}.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cloudflared-${location}.error.log</string>
</dict>
</plist>
EOF
        
        # Load the service
        launchctl load "$PLIST_FILE"
        
        print_success "Created launchd service: com.cloudflare.${location}"
        echo "Service will start automatically"
    fi
}

# Generate environment variables
generate_env_vars() {
    local location=$1
    local tunnel_id=$2
    
    print_info "Generating environment variables for ${location}..."
    
    ENV_FILE=".env.${location}"
    
    cat > "$ENV_FILE" << EOF
# Cloudflare Tunnel Configuration for ${location}
CLOUDFLARE_TUNNEL_${location^^}_ID=${tunnel_id}
CLOUDFLARE_TUNNEL_${location^^}_HOSTNAME=${location}-unifi.clubos.internal
UNIFI_${location^^}_TOKEN=# Add your UniFi Access API token here
EOF
    
    print_success "Created environment file: $ENV_FILE"
}

# Test tunnel connection
test_tunnel() {
    local location=$1
    
    print_info "Testing tunnel for ${location}..."
    
    # Try to reach the health endpoint
    HEALTH_URL="https://${location}-health.clubos.internal"
    
    if curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" | grep -q "200\|404"; then
        print_success "Tunnel is working for ${location}"
    else
        print_warning "Tunnel test failed for ${location}"
        echo "This might be normal if the UniFi controller is not yet configured"
    fi
}

# Main setup flow
main() {
    print_header "Cloudflare Tunnel Setup for UniFi Access"
    
    # Check prerequisites
    check_cloudflared
    
    # Login to Cloudflare
    cloudflare_login
    
    # Get location
    echo ""
    echo "Which location do you want to set up?"
    echo "1) Dartmouth"
    echo "2) Bedford"
    echo "3) Stratford"
    echo "4) Bayers Lake"
    echo "5) Truro"
    echo "6) All locations"
    read -p "Enter choice (1-6): " choice
    
    case $choice in
        1) LOCATIONS=("dartmouth") ;;
        2) LOCATIONS=("bedford") ;;
        3) LOCATIONS=("stratford") ;;
        4) LOCATIONS=("bayerslake") ;;
        5) LOCATIONS=("truro") ;;
        6) LOCATIONS=("dartmouth" "bedford" "stratford" "bayerslake" "truro") ;;
        *) print_error "Invalid choice"; exit 1 ;;
    esac
    
    # Process each location
    for location in "${LOCATIONS[@]}"; do
        print_header "Setting up ${location}"
        
        # Create tunnel
        create_tunnel "$location"
        
        # Get tunnel ID
        if [ -f ".tunnel-${location}.id" ]; then
            TUNNEL_ID=$(cat ".tunnel-${location}.id")
        else
            print_error "Tunnel ID not found for ${location}"
            continue
        fi
        
        # Create configuration
        create_config "$location" "$TUNNEL_ID"
        
        # Setup DNS
        setup_dns "$location" "$TUNNEL_ID"
        
        # Create service
        read -p "Do you want to create a system service for ${location}? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_service "$location" "$TUNNEL_ID"
        fi
        
        # Generate env vars
        generate_env_vars "$location" "$TUNNEL_ID"
        
        # Test tunnel
        test_tunnel "$location"
    done
    
    print_header "Setup Complete!"
    
    echo "Next steps:"
    echo "1. Copy the environment variables from .env.${LOCATIONS[0]} to your main .env file"
    echo "2. Add your UniFi Access API tokens to the environment variables"
    echo "3. Set UNIFI_USE_CLOUDFLARE=true in your .env file"
    echo "4. Restart your ClubOS backend service"
    echo ""
    echo "To test the tunnels:"
    echo "  npm run test:cloudflare-tunnels"
    echo ""
    echo "To run the migration:"
    echo "  npm run migrate:cloudflare"
}

# Run main function
main