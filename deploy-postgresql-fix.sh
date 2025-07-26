#!/bin/bash
echo "🚀 Deploying PostgreSQL fixes"
echo "============================"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Build the project
echo "Building project..."
npm run build

# Go back to root and commit
cd ..
git add -A
git commit -m "Complete PostgreSQL implementation fix

- Added all missing database methods (query, log methods, etc.)
- Fixed requestLogger to use PostgreSQL
- Added cancelBooking method
- Added access/auth/request log retrieval methods
- Fixed getBookings to support status filter
- Removed problematic JSON file"

git push origin main

echo "✅ PostgreSQL fixes deployed!"
echo "Monitor Railway for deployment status."
