#!/bin/bash
echo "🚀 Deploying PostgreSQL Integration with JSON Fallback"
echo "===================================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Build the project
echo "📦 Building backend..."
npm run build

# Check if build succeeded
if [ $? -eq 0 ]; then
  echo "✅ Build successful"
else
  echo "❌ Build failed"
  exit 1
fi

cd ..

# Commit and push
git add -A
git commit -m "Implement PostgreSQL with JSON fallback

- Created robust database service with connection pooling
- Handles both 'Users' and 'users' table case sensitivity
- Auth routes use database first, fall back to JSON
- Feedback routes use database first, fall back to JSON  
- Tickets routes use database first, fall back to JSON
- Graceful error handling - app works even if database fails
- All data saved to both PostgreSQL and JSON for safety
- No data loss if database connection fails

Features:
- If DATABASE_URL exists, uses PostgreSQL
- If database fails, automatically uses JSON files
- All operations work seamlessly with either storage
- Status indicators show which storage is being used"

git push origin main

echo -e "\n✅ Deployment complete!"
echo "============================"
echo "What happens next:"
echo "1. Railway will auto-deploy the changes"
echo "2. Watch the logs for:"
echo "   - '✅ Database initialized successfully' (PostgreSQL working)"
echo "   - '⚠️ Database initialization failed' (JSON fallback)"
echo "3. Either way, your app will work!"
echo ""
echo "To verify persistence:"
echo "1. Create a ticket"
echo "2. Check if it shows 'storage: database' in the response"
echo "3. Redeploy and check if ticket persists"
