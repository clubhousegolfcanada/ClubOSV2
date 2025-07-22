#!/bin/bash

echo "🔄 Restarting Backend Without Rate Limiting"
echo "=========================================="
echo ""

# Stop the backend
echo "Stopping backend..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true

sleep 2

# Clear any rate limit data
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Clear potential rate limit files
echo "Clearing rate limit data..."
rm -rf src/data/usage/ 2>/dev/null || true
rm -f src/data/rateLimits.json 2>/dev/null || true
rm -f src/data/usageData.json 2>/dev/null || true

# Make sure the data directories exist
mkdir -p src/data/logs
mkdir -p src/data/sync
mkdir -p src/data/backups

# Set NODE_ENV to bypass rate limiting
export NODE_ENV=development
export DISABLE_RATE_LIMIT=true

echo ""
echo "Starting backend without rate limiting..."
npm run dev
