#!/bin/bash

# Deploy Ticket Center Optimization

echo "🚀 Deploying Ticket Center Optimization"
echo "====================================="

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Check git status
echo "📋 Current git status:"
git status

# Add the new components
echo -e "\n✅ Adding ticket center files..."
git add ClubOSV1-frontend/src/components/TicketCenterOptimized.tsx
git add ClubOSV1-frontend/src/pages/tickets.tsx
git add TICKET_CENTER_SIMPLE_PLAN.md

# Create commit
echo -e "\n💾 Creating commit..."
git commit -m "feat: Optimize Ticket Center for mobile and efficiency

- Created compact, mobile-friendly ticket cards
- Added search functionality
- Added priority indicators (color dots)
- Added quick actions (comment and quick resolve)
- Optimized for mobile with horizontal scroll filters
- Maintained simplicity - no complex features added
- Improved touch targets for mobile use"

# Push to deploy
echo -e "\n🚀 Pushing to deploy..."
git push origin main

echo -e "\n✅ Deployment initiated!"
echo "Frontend will deploy to Vercel in 1-2 minutes"
echo "Check: https://your-vercel-url.vercel.app/tickets"
