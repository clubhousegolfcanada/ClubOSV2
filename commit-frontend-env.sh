#!/bin/bash

# Git Commit Script for ClubOS Frontend Environment Setup

echo "📦 Committing ClubOS Frontend Environment Configuration"
echo "====================================================="

# Navigate to frontend directory
cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend"

# Check git status
echo "📋 Current git status:"
git status

# Add the environment file
echo -e "\n✅ Adding environment configuration..."
git add .env.local

# Create commit
echo -e "\n💾 Creating commit..."
git commit -m "feat: Add frontend environment configuration for Railway backend

- Added .env.local with NEXT_PUBLIC_API_URL placeholder
- Frontend can now be configured to connect to deployed Railway backend
- Fixes 'Failed to get conversation statistics' error
- Users need to update with their actual Railway backend URL"

echo -e "\n✅ Commit created successfully!"
echo -e "\n📝 Next steps:"
echo "1. Update .env.local with your actual Railway backend URL"
echo "2. Restart the frontend server (npm run dev)"
echo "3. The OpenPhone integration should now work correctly"

# Show the last commit
echo -e "\n📊 Last commit:"
git log -1 --oneline
