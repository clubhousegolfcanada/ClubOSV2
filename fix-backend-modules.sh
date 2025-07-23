#!/bin/bash

echo "🔧 Fixing backend module error..."

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Clean and reinstall dependencies
echo "Cleaning node_modules..."
rm -rf node_modules
rm -f package-lock.json

echo "Reinstalling dependencies..."
npm install

echo "✅ Dependencies reinstalled!"
echo ""
echo "Now try running the backend again:"
echo "npm run dev"
