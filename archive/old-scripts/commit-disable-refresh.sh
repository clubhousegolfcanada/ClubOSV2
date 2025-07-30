#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

git add -A
git commit -m "fix: disable auto-refresh in Recent Messages to prevent rate limiting

- Comment out 8-second interval refresh that was causing 429 errors
- Replace 'Auto-updates every 8s' with manual refresh button
- Prevents rate limit issues when importing large amounts of data
- Users can still manually refresh messages when needed

This fixes the rate limiting issue that was blocking knowledge imports."

echo "✅ Changes committed!"
git log -1 --oneline
