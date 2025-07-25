#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Enhance ClubOS Boy kiosk mode for 24/7 operation

- Add heartbeat ping every 5 minutes to keep connection alive
- Add page visibility handler to refresh state when tab becomes active
- Prevent browser caching with meta tags
- Fix API endpoint to use /customer/ask instead of /requests
- Add error handling with auto-reset after 30 seconds
- Disable browser back/forward cache (bfcache) for fresh loads
- Ensure kiosk can run indefinitely without authentication timeouts"
git push origin main
