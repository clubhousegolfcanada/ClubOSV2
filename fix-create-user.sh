#!/bin/bash
echo "🔧 Fixing createUser to include createdAt and updatedAt"
echo "====================================================="

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-backend

# Fix the createUser function to include all required columns
echo "Updating createUser function..."
sed -i '' 's/INSERT INTO "Users" (id, email, password, name, role, phone)/INSERT INTO "Users" (id, email, password, name, role, phone, "createdAt", "updatedAt", "isActive")/g' src/utils/database.ts
sed -i '' 's/VALUES (\$1, \$2, \$3, \$4, \$5, \$6)/VALUES (\$1, \$2, \$3, \$4, \$5, \$6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)/g' src/utils/database.ts

# Also fix the updateUser function to use quoted column names
echo "Fixing updateUser function..."
sed -i '' 's/SET updated_at = CURRENT_TIMESTAMP/SET "updatedAt" = CURRENT_TIMESTAMP/g' src/utils/database.ts

# Fix updateLastLogin to use quoted column name
echo "Fixing updateLastLogin function..."
sed -i '' 's/SET last_login = CURRENT_TIMESTAMP/SET "lastLogin" = CURRENT_TIMESTAMP/g' src/utils/database.ts

# Build and deploy
npm run build

cd ..
git add -A
git commit -m "Fix createUser function to include required columns

- Added createdAt, updatedAt, and isActive to INSERT query
- Fixed column names to use quoted camelCase
- This resolves the null constraint error when creating users"

git push origin main

echo "✅ createUser fix deployed!"