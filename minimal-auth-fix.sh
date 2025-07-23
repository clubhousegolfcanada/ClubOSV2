#!/bin/bash

# Minimal fix for auth - just update interfaces

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔧 Applying minimal auth fix"
echo "============================"

# Commit the current changes
git add -A
git commit -m "fix: Update auth interfaces to include name and phone

- Add name and phone to Request user interface
- Add name and phone to JWTPayload interface  
- Include these fields when creating req.user
- This fixes 401 errors on authenticated routes"

# Push
git push origin main

echo "✅ Fix pushed!"
echo "=============="
echo "📌 Railway will redeploy in 2-3 minutes"
echo "📌 After deployment completes:"
echo "   1. Logout (clear localStorage)"
echo "   2. Login fresh to get new token"
echo "   3. Both Slack and feedback should work"
