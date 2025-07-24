#!/bin/bash

echo "🔧 Fixing phone number validation..."
echo ""

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Add the backend changes
cd ClubOSV1-backend
git add src/routes/auth.ts

# Commit
git commit -m "fix: make phone number truly optional in user creation

- Added checkFalsy: true to phone validation
- Now accepts empty string, null, or undefined for phone
- Phone field is properly optional in both create and update endpoints"

# Push
git push origin main

echo ""
echo "✅ Phone validation fix deployed!"
echo ""
echo "=== CHANGES MADE ==="
echo "- Phone field now accepts empty values"
echo "- Validation only applies if phone is provided"
echo "- Both /register and /users/:id endpoints fixed"
echo ""
echo "=== DEPLOYMENT ==="
echo "- Backend will restart automatically"
echo "- Changes effective immediately"
echo ""
echo "=== USER MANAGEMENT ==="
echo "Access user management at:"
echo "1. Go to Operations page (admin only)"
echo "2. Backup button - downloads all data as JSON"
echo "3. Restore button - upload a backup file"
echo "4. Add User - phone field is now optional"
