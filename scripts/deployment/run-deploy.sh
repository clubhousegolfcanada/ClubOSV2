#!/bin/bash

echo "🚀 Running deployment for full-width fix..."
echo ""

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend"

# Make the deployment script executable and run it
chmod +x ../deploy-fullwidth-fix.sh
../deploy-fullwidth-fix.sh

echo ""
echo "🎯 Deployment command executed!"
echo ""
echo "=== MONITOR DEPLOYMENT ==="
echo "Check your Vercel dashboard for deployment progress:"
echo "https://vercel.com/dashboard"
echo ""
echo "After deployment completes (2-3 minutes):"
echo "1. Clear browser cache"
echo "2. Refresh your HubSpot page"
echo "3. ClubOS should now fill the full width!"
