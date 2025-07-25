#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1
git add -A
git commit -m "Fix database persistence - update setupDatabase to create all tables

- Updated setupDatabase.js to create feedback and tickets tables on startup
- Modified tickets route to use PostgreSQL instead of JSON files
- Added kiosk role to user enum
- Tables now created automatically when app starts on Railway
- Added table statistics logging to verify creation
- Fixed data persistence issue across deployments"
git push origin main
