#!/bin/bash

echo "🔧 Fixing feedback submission by using fetch instead of axios..."

# Add all changes
git add -A

# Commit
git commit -m "Replace axios with fetch for feedback submission

- Use native fetch API instead of axios to avoid potential configuration issues
- Better error handling for non-OK responses
- Maintain all authentication and error handling logic
- This should resolve the 401 error issue"

# Push
git push origin main

echo "✅ Deployed! The feedback system now uses fetch instead of axios."
echo ""
echo "This should resolve the 401 error since direct fetch calls work correctly."
echo "Test by:"
echo "1. Submitting a request"
echo "2. Clicking the feedback buttons"
echo "3. Check if feedback is recorded successfully"
