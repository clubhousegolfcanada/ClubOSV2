#!/bin/bash

echo "🗑️  Removing Test Role Switcher..."
echo ""

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-frontend"

# Add the updated index page
git add src/pages/index.tsx

# Commit
git commit -m "remove: test role switcher from dashboard

- Removed RoleSwitcher component from index page
- No longer needed for production
- Cleaner UI without the overlay"

# Push
git push origin main

echo ""
echo "✅ Test Role Switcher removed!"
echo ""
echo "=== CHANGES ==="
echo "- Removed RoleSwitcher import from index.tsx"
echo "- Removed RoleSwitcher component from dashboard"
echo "- The overlay will no longer appear"
echo ""
echo "=== DEPLOYMENT: 2-3 minutes ==="
