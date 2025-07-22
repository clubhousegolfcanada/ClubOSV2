#!/bin/bash

echo "🔧 Deploying feedback debugging improvements..."

# Add all changes
git add -A

# Commit
git commit -m "Add detailed debugging for feedback 401 error

- Add more console logging to track API URL
- Log token details when submitting feedback
- Fix API URL formatting
- Remove incorrect import
- Log full response data"

# Push
git push origin main

echo "✅ Deployed! Now when you test:"
echo "1. Open browser console (F12)"
echo "2. Submit a request"
echo "3. Click the feedback button"
echo "4. Check console for:"
echo "   - API_URL configured: ..."
echo "   - Sending feedback: ..."
echo "   - Token (first 20 chars): ..."
echo "   - Full API URL: ..."
echo ""
echo "This will help identify why the API call is failing."
