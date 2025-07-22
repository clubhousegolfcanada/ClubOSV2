#!/bin/bash

echo "🔧 Installing Required Dependencies"
echo "==================================="
echo ""

# Navigate to the ClubOSV1 directory
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Install dependencies in the main directory for our scripts
echo "📦 Installing axios and bcryptjs..."
npm init -y > /dev/null 2>&1
npm install axios bcryptjs

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "Now you can run: node check-system.js"
