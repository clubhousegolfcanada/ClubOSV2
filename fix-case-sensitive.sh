#!/bin/bash
echo "🔧 Quick case-sensitive fix"
echo "=========================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Fix all lowercase 'users' references to "Users" with quotes
sed -i '' 's/UPDATE users SET/UPDATE "Users" SET/g' src/utils/database.ts
sed -i '' 's/DELETE FROM users/DELETE FROM "Users"/g' src/utils/database.ts
sed -i '' 's/FROM users/FROM "Users"/g' src/utils/database.ts
sed -i '' 's/idx_users_email ON users/idx_users_email ON "Users"/g' src/utils/database.ts

# Build
npm run build

cd ..
git add -A
git commit -m "Fix: Case sensitivity for Users table

- Fixed all references from 'users' to 'Users' with quotes
- This fixes the app crash on startup"
git push origin main

echo "✅ Fix pushed!"
