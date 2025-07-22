#!/bin/bash

echo "🔍 Checking ClubOSV1 Services"
echo "============================="
echo ""

# Check if frontend is running on port 3000
echo "Frontend (port 3000):"
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not running"
fi

echo ""

# Check if backend is running on port 3001
echo "Backend (port 3001):"
if lsof -i :3001 > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not running"
    echo ""
    echo "To start the backend:"
    echo "cd ClubOSV1-backend"
    echo "npm run dev"
fi

echo ""
echo "If both are running, try: node quick-fix.js"
