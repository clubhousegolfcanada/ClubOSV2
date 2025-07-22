#!/bin/bash

# ClubOSV1 Development Environment Setup Script
# This script sets up and starts both frontend and backend servers

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# ASCII Art Banner
echo -e "${GREEN}"
echo "  ____  _       _      ___  ______     _____ "
echo " / ___|| |_   _| |__  / _ \/ ___\ \   / / /_ |"
echo "| |    | | | | | '_ \| | | \___ \\ \ / / | | |"
echo "| |___ | | |_| | |_) | |_| |___) |\ V /  | | |"
echo " \____||_|\__,_|_.__/ \___/|____/  \_/   |_|_|"
echo -e "${NC}"
echo "Development Environment Setup Script"
echo "=================================="
echo ""

# Set base directory
BASE_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Check if directory exists
if [ ! -d "$BASE_DIR" ]; then
    print_error "ClubOSV1 directory not found at: $BASE_DIR"
    exit 1
fi

# Navigate to base directory
cd "$BASE_DIR"
print_status "Working directory: $(pwd)"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    print_status "Please install Node.js first using one of these methods:"
    echo ""
    echo "  1. Using Homebrew:"
    echo "     brew install node"
    echo ""
    echo "  2. Download from https://nodejs.org/"
    echo ""
    echo "  3. Using nvm:"
    echo "     curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "     source ~/.zshrc"
    echo "     nvm install --lts"
    echo ""
    exit 1
fi

print_success "Node.js $(node --version) detected"
print_success "npm $(npm --version) detected"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port)
    if [ ! -z "$pid" ]; then
        print_warning "Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi
}

# Check and handle port conflicts
print_status "Checking for port conflicts..."

if check_port 3000; then
    print_warning "Port 3000 is already in use"
    read -p "Kill the process on port 3000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 3000
    else
        print_error "Cannot start frontend - port 3000 is in use"
        exit 1
    fi
fi

if check_port 3001; then
    print_warning "Port 3001 is already in use"
    read -p "Kill the process on port 3001? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill_port 3001
    else
        print_error "Cannot start backend - port 3001 is in use"
        exit 1
    fi
fi

# Function to setup frontend
setup_frontend() {
    print_status "Setting up frontend..."
    cd "$BASE_DIR/ClubOSV1-frontend"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    else
        print_success "Frontend dependencies already installed"
    fi
    
    # Check if .env.local exists
    if [ ! -f ".env.local" ]; then
        if [ -f ".env" ]; then
            print_status "Creating .env.local from .env..."
            cp .env .env.local
        fi
    fi
}

# Function to setup backend
setup_backend() {
    print_status "Setting up backend..."
    cd "$BASE_DIR/ClubOSV1-backend"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing backend dependencies..."
        npm install
    else
        print_success "Backend dependencies already installed"
    fi
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        print_error ".env file not found in backend!"
        print_status "Please configure your environment variables:"
        echo "  1. cd $BASE_DIR/ClubOSV1-backend"
        echo "  2. cp .env.example .env  (if .env.example exists)"
        echo "  3. Edit .env and add your API keys"
    fi
}

# Function to start servers
start_servers() {
    print_status "Starting servers..."
    
    # Use osascript to open new terminal tabs on macOS
    osascript <<EOF
tell application "Terminal"
    # Open new tab for backend
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    do script "cd '$BASE_DIR/ClubOSV1-backend' && echo -e '${GREEN}Starting ClubOSV1 Backend...${NC}' && npm run dev" in selected tab of the front window
    
    # Open new tab for frontend
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    do script "cd '$BASE_DIR/ClubOSV1-frontend' && echo -e '${GREEN}Starting ClubOSV1 Frontend...${NC}' && npm run dev" in selected tab of the front window
end tell
EOF
}

# Main execution
echo ""
print_status "Starting ClubOSV1 setup..."
echo ""

# Setup frontend
setup_frontend

echo ""

# Setup backend
setup_backend

echo ""

# Start servers
print_status "Would you like to start the development servers? (y/n)"
read -p "> " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    start_servers
    echo ""
    print_success "Setup complete! Servers are starting..."
    echo ""
    print_status "Frontend will be available at: http://localhost:3000"
    print_status "Backend will be available at: http://localhost:3001"
    echo ""
    print_status "Check the new Terminal tabs for server logs"
else
    echo ""
    print_success "Setup complete!"
    echo ""
    print_status "To start the servers manually:"
    echo "  Frontend: cd $BASE_DIR/ClubOSV1-frontend && npm run dev"
    echo "  Backend:  cd $BASE_DIR/ClubOSV1-backend && npm run dev"
fi

echo ""
print_status "Happy coding! 🚀"
