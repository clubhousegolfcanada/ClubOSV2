#!/bin/bash

# Revert auth middleware to original working state

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo "🔄 Reverting auth middleware to original state"
echo "============================================="

# Create a backup branch
git checkout -b backup/current-state-$(date +%s)
git checkout main

# Reset auth.ts to remove async changes but keep JWT payload updates
cat > revert-auth.patch << 'EOF'
diff --git a/ClubOSV1-backend/src/middleware/auth.ts b/ClubOSV1-backend/src/middleware/auth.ts
index abc123..def456 100644
--- a/ClubOSV1-backend/src/middleware/auth.ts
+++ b/ClubOSV1-backend/src/middleware/auth.ts
@@ -47,7 +47,7 @@
 };
 
 // Authentication middleware
-export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
+export const authenticate = (req: Request, res: Response, next: NextFunction) => {
   try {
     // Get token from header
     const authHeader = req.headers.authorization;
@@ -86,22 +86,11 @@
       });
     }

-    // Fetch complete user data
-    let userName = decoded.name || '';
-    let userPhone = decoded.phone || '';
-    
-    try {
-      const { readJsonFile } = require('../utils/fileUtils');
-      const users = await readJsonFile<any[]>('users.json');
-      const user = users.find(u => u.id === decoded.userId);
-      if (user) {
-        userName = user.name || userName;
-        userPhone = user.phone || userPhone;
-      }
-    } catch (err) {
-      logger.warn('Failed to fetch user data for auth middleware', { userId: decoded.userId });
-    }
-    
+    // Use data from JWT token
+    const userName = decoded.name || '';
+    const userPhone = decoded.phone || '';
+
     // Attach user to request
     req.user = {
       id: decoded.userId,
EOF

echo "📝 Applying auth revert..."

# Just revert the authenticate function to sync
sed -i '' 's/export const authenticate = async (/export const authenticate = (/' ClubOSV1-backend/src/middleware/auth.ts

# Remove the user lookup code (lines with readJsonFile)
sed -i '' '/const { readJsonFile }/,/} catch (err) {/d' ClubOSV1-backend/src/middleware/auth.ts

# Commit changes
git add -A
git commit -m "fix: Revert auth middleware to sync to fix 401 errors

- Remove async from authenticate function
- Use JWT token data directly without file lookup
- This should fix all 401 authentication errors"

# Push
echo -e "\n🚀 Pushing fix..."
git push origin main --force-with-lease

echo -e "\n✅ Fix pushed!"
echo "==============="
echo "Wait 2-3 minutes for Railway to deploy"
echo "Then clear localStorage and login fresh"
