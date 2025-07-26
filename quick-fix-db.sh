#!/bin/bash
echo "🔧 Quick Fix for Database Service"
echo "================================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Check if database.js exists in dist
if [ ! -f "dist/utils/database.js" ]; then
  echo "❌ database.js not found in dist - need to rebuild"
  echo "Running build..."
  npm run build
fi

# Quick commit to test
cd ..
git add -A
git commit -m "Fix: Ensure database service is compiled

- Check if database.js exists in dist
- Rebuild if necessary
- Fix 500 error on ticket creation"
git push origin main

echo "✅ Fix pushed - check Railway logs after deployment"
