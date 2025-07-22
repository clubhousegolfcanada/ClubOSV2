#!/bin/bash

echo "🚀 Starting ClubOSV1 Services"
echo "============================="
echo ""

# Function to open a new terminal and run a command (macOS)
open_terminal() {
    osascript -e "tell application \"Terminal\" to do script \"cd '$1' && $2\""
}

# Start Backend
echo "1️⃣ Starting Backend..."
BACKEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
open_terminal "$BACKEND_DIR" "npm run dev"

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo "2️⃣ Starting Frontend..."
FRONTEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend"
open_terminal "$FRONTEND_DIR" "npm run dev"

echo ""
echo "✅ Both services are starting in new Terminal windows!"
echo ""
echo "Wait a few seconds, then visit:"
echo "👉 http://localhost:3000/login"
echo ""
echo "Login with:"
echo "Email: admin@clubhouse247golf.com"
echo "Password: ClubhouseAdmin123!"
