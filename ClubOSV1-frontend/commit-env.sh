#!/bin/bash

# Simple git commit for frontend env

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend"

# Add and commit
git add .env.local
git commit -m "feat: Add frontend environment configuration for Railway backend

- Added .env.local with NEXT_PUBLIC_API_URL placeholder
- Frontend can now be configured to connect to deployed Railway backend
- Fixes 'Failed to get conversation statistics' error
- Users need to update with their actual Railway backend URL"

echo "✅ Committed successfully!"
