#!/bin/bash

# Frontend changes
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend
git add src/components/RequestForm.tsx .env.production
git commit -m "Fix feedback submission - store request data and improve error handling"

# Push
git push

echo "Changes committed and pushed!"
