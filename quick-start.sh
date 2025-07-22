#!/bin/bash

echo "🚀 Quick Start ClubOSV1"
echo "======================"
echo ""

# Start Backend in background
echo "Starting Backend..."
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend
nohup npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start Frontend in background
echo "Starting Frontend..."
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ Services starting..."
echo ""
echo "Wait 5-10 seconds, then visit:"
echo "👉 http://localhost:3000/login"
echo ""
echo "To stop services:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "To view logs:"
echo "tail -f ClubOSV1-backend/backend.log"
echo "tail -f ClubOSV1-frontend/frontend.log"
