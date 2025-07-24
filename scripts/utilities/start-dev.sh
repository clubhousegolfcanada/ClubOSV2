#!/bin/bash

# ClubOS Development Startup Script
# This script starts both the backend and frontend servers

echo "🚀 Starting ClubOS Development Environment..."
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Kill any existing processes on our ports
echo -e "${BLUE}Checking for existing processes...${NC}"

if check_port 3001; then
    echo -e "${RED}Port 3001 is in use. Killing existing process...${NC}"
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

if check_port 3000; then
    echo -e "${RED}Port 3000 is in use. Killing existing process...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Start Backend
echo -e "\n${GREEN}Starting Backend Server on port 3001...${NC}"
cd "$(dirname "$0")/ClubOSV1-backend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    npm install
fi

# Start backend in development mode
echo -e "${GREEN}Backend starting...${NC}"
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
echo -e "${BLUE}Waiting for backend to be ready...${NC}"
sleep 5

# Check if backend started successfully
if ! check_port 3001; then
    echo -e "${RED}Backend failed to start! Check the logs above.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backend is running on http://localhost:3001${NC}"

# Start Frontend
echo -e "\n${GREEN}Starting Frontend Server on port 3000...${NC}"
cd "../ClubOSV1-frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    npm install
fi

# Start frontend
echo -e "${GREEN}Frontend starting...${NC}"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
echo -e "${BLUE}Waiting for frontend to be ready...${NC}"
sleep 5

# Check if frontend started successfully
if ! check_port 3000; then
    echo -e "${RED}Frontend failed to start! Check the logs above.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✓ Frontend is running on http://localhost:3000${NC}"

# Success message
echo -e "\n================================================"
echo -e "${GREEN}🎉 ClubOS is ready!${NC}"
echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
echo -e "Backend:  ${BLUE}http://localhost:3001${NC}"
echo -e "\n${BLUE}Press Ctrl+C to stop both servers${NC}"
echo -e "================================================\n"

# Function to handle shutdown
shutdown() {
    echo -e "\n${BLUE}Shutting down ClubOS...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}✓ ClubOS stopped${NC}"
    exit 0
}

# Set up trap to handle Ctrl+C
trap shutdown INT

# Keep script running and show logs
wait
