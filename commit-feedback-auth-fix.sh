#!/bin/bash

# Script to fix feedback 401 authentication error

echo "🔧 Fixing feedback authentication error..."

# Add all changes
git add -A

# Commit with descriptive message
git commit -m "Fix feedback 401 error - handle authentication properly

- Check if user is authenticated before submitting feedback
- Redirect to login if token is missing or expired
- Better error handling for 401 responses
- Store location to redirect back after login
- Add detailed error logging for debugging"

# Push to main branch
git push origin main

echo "✅ Fix deployed! The feedback system will now:"
echo "  - Check authentication before submitting"
echo "  - Redirect to login if needed"
echo "  - Handle expired sessions gracefully"
echo "  - Show clear error messages"
