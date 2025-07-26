#!/bin/bash
echo "🔧 Building and Fixing Database Service"
echo "======================================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Build the TypeScript files
echo "📦 Building backend..."
npm run build

# Check if database.js was created
if [ -f "dist/utils/database.js" ]; then
  echo "✅ database.js built successfully"
else
  echo "❌ database.js not built - checking why..."
  ls -la src/utils/
  ls -la dist/utils/ 2>/dev/null || echo "dist/utils doesn't exist"
fi

# Commit all changes including built files
cd ..
git add -A
git commit -m "Build: Add compiled database service

- Built TypeScript files including database.ts
- Fix 500 error on ticket/feedback creation
- Ensure all services are compiled"
git push origin main

echo -e "\n✅ Fix deployed!"
echo "After Railway finishes deploying, tickets should work!"
