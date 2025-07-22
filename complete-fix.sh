#!/bin/bash

echo "🔧 ClubOSV1 Complete Setup & Fix"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -d "ClubOSV1-backend" ] || [ ! -d "ClubOSV1-frontend" ]; then
    echo "❌ Error: Not in the ClubOSV1 directory!"
    echo "Please cd to: /Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"
    exit 1
fi

# Function to check if a port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
    return $?
}

# Check frontend status
echo "1️⃣ Checking frontend (port 3000)..."
if check_port 3000; then
    echo "✅ Frontend is running on http://localhost:3000"
else
    echo "❌ Frontend is not running"
fi

# Check backend status
echo ""
echo "2️⃣ Checking backend (port 3001)..."
if check_port 3001; then
    echo "✅ Backend is running on http://localhost:3001"
else
    echo "❌ Backend is not running"
    echo ""
    echo "Starting backend..."
    # Start backend in background
    cd ClubOSV1-backend
    npm run dev > backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    echo "Waiting for backend to start..."
    sleep 5
    
    if check_port 3001; then
        echo "✅ Backend started successfully (PID: $BACKEND_PID)"
    else
        echo "❌ Failed to start backend. Check ClubOSV1-backend/backend.log for errors"
        exit 1
    fi
fi

# Install required dependencies
echo ""
echo "3️⃣ Installing required dependencies..."
cd ClubOSV1-backend
npm install bcryptjs axios > /dev/null 2>&1
cd ..

# Run the system check and password reset
echo ""
echo "4️⃣ Checking and fixing admin user..."
node check-system.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Summary:"
echo "   Frontend: http://localhost:3000"
echo "   Backend: http://localhost:3001"
echo "   Login: http://localhost:3000/login"
echo ""
echo "🔑 Admin Credentials:"
echo "   Email: admin@clubhouse247golf.com"
echo "   Password: ClubhouseAdmin123!"
echo ""
echo "If you still can't login, try:"
echo "1. Clear your browser cache/cookies"
echo "2. Open an incognito/private window"
echo "3. Make sure both frontend and backend are running"
