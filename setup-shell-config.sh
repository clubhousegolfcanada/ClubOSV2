#!/bin/bash

# ClubOSV1 Shell Configuration Setup
# This script adds useful aliases and functions to your shell configuration

echo "ClubOSV1 Shell Configuration Setup"
echo "================================="

# Detect shell
if [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
    echo "Detected ZSH shell"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
    echo "Detected Bash shell"
else
    echo "Could not detect shell type"
    exit 1
fi

# Create backup
cp "$SHELL_CONFIG" "$SHELL_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"
echo "Created backup of $SHELL_CONFIG"

# Add ClubOSV1 configuration
cat >> "$SHELL_CONFIG" << 'EOF'

# ===== ClubOSV1 Development Aliases =====
# Added by ClubOSV1 setup script

# Base directory
export CLUBOS_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Navigation aliases
alias clubos='cd "$CLUBOS_DIR"'
alias clubos-fe='cd "$CLUBOS_DIR/ClubOSV1-frontend"'
alias clubos-be='cd "$CLUBOS_DIR/ClubOSV1-backend"'

# Development commands
alias clubos-start='cd "$CLUBOS_DIR" && ./start-clubos.sh'
alias clubos-quick='cd "$CLUBOS_DIR" && ./quick-start.sh'
alias clubos-install='cd "$CLUBOS_DIR/ClubOSV1-frontend" && npm install && cd "$CLUBOS_DIR/ClubOSV1-backend" && npm install'

# Individual server commands
alias clubos-fe-start='cd "$CLUBOS_DIR/ClubOSV1-frontend" && npm run dev'
alias clubos-be-start='cd "$CLUBOS_DIR/ClubOSV1-backend" && npm run dev'

# Testing commands
alias clubos-test='cd "$CLUBOS_DIR/ClubOSV1-backend" && npm test'
alias clubos-test-watch='cd "$CLUBOS_DIR/ClubOSV1-backend" && npm run test:watch'

# Utility commands
alias clubos-logs='cd "$CLUBOS_DIR/ClubOSV1-backend" && tail -f logs/*.log'
alias clubos-clean='cd "$CLUBOS_DIR/ClubOSV1-frontend" && rm -rf node_modules .next && cd "$CLUBOS_DIR/ClubOSV1-backend" && rm -rf node_modules dist'

# Function to open ClubOSV1 in VS Code
clubos-code() {
    code "$CLUBOS_DIR"
}

# Function to check ClubOSV1 status
clubos-status() {
    echo "ClubOSV1 Status Check"
    echo "===================="
    
    # Check if frontend is running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        echo "✅ Frontend is running on port 3000"
    else
        echo "❌ Frontend is not running"
    fi
    
    # Check if backend is running
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
        echo "✅ Backend is running on port 3001"
    else
        echo "❌ Backend is not running"
    fi
    
    # Check Node version
    echo ""
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
}

# Function to kill ClubOSV1 servers
clubos-kill() {
    echo "Stopping ClubOSV1 servers..."
    
    # Kill frontend
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
        kill -9 $(lsof -ti:3000) 2>/dev/null
        echo "✅ Stopped frontend server"
    fi
    
    # Kill backend
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
        kill -9 $(lsof -ti:3001) 2>/dev/null
        echo "✅ Stopped backend server"
    fi
}

# Show available ClubOSV1 commands
clubos-help() {
    echo "ClubOSV1 Commands:"
    echo "=================="
    echo "  clubos          - Navigate to ClubOSV1 directory"
    echo "  clubos-fe       - Navigate to frontend directory"
    echo "  clubos-be       - Navigate to backend directory"
    echo "  clubos-start    - Run full setup and start servers"
    echo "  clubos-quick    - Quick start both servers"
    echo "  clubos-install  - Install dependencies for both projects"
    echo "  clubos-fe-start - Start frontend only"
    echo "  clubos-be-start - Start backend only"
    echo "  clubos-test     - Run backend tests"
    echo "  clubos-status   - Check server status"
    echo "  clubos-kill     - Stop all servers"
    echo "  clubos-code     - Open in VS Code"
    echo "  clubos-help     - Show this help message"
}

# ===== End ClubOSV1 Configuration =====
EOF

echo ""
echo "✅ Shell configuration updated!"
echo ""
echo "To activate the new configuration, run:"
echo "  source $SHELL_CONFIG"
echo ""
echo "Or open a new terminal window."
echo ""
echo "Type 'clubos-help' to see all available commands."
