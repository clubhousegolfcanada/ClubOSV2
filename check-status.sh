#!/bin/bash

echo "🔍 Checking ClubOSV1 Services Status"
echo "===================================="
echo ""

# Check frontend on port 3000
echo "1️⃣ Frontend (port 3000):"
if lsof -i :3000 > /dev/null 2>&1; then
    echo "✅ Running"
    echo "   URL: http://localhost:3000"
else
    echo "❌ Not running"
    echo "   To start: cd ClubOSV1-frontend && npm run dev"
fi

echo ""

# Check backend on port 3001
echo "2️⃣ Backend (port 3001):"
if lsof -i :3001 > /dev/null 2>&1; then
    echo "✅ Running"
    echo "   URL: http://localhost:3001"
else
    echo "❌ Not running"
    echo "   To start: cd ClubOSV1-backend && npm run dev"
fi

echo ""
echo "3️⃣ Quick Start Commands:"
echo "========================"
echo ""
echo "Start Frontend (Terminal 1):"
echo "cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend"
echo "npm run dev"
echo ""
echo "Start Backend (Terminal 2):"
echo "cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend"
echo "npm run dev"
