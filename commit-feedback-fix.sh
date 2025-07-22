#!/bin/bash

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Backend changes
cd ClubOSV1-backend
git add src/routes/feedback.ts src/utils/fileUtils.ts
git commit -m "Fix feedback logging to use consistent data directory and authentication"

# Frontend changes  
cd ../ClubOSV1-frontend
git add src/components/RequestForm.tsx
git commit -m "Add authentication token to feedback API calls"

# Push both
cd ..
git push

echo "Changes committed and pushed!"
