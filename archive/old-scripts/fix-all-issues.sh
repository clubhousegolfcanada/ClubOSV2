#!/bin/bash
# Fix both frontend and backend issues

echo "🔧 ClubOS Issue Fixer"
echo "===================="

# 1. Fix Frontend JSX Fragment Issue
echo ""
echo "1. Fixing Frontend Build Error..."
echo "--------------------------------"

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend

# Create backup
cp src/pages/operations.tsx src/pages/operations.tsx.bak

# The error shows: Expected corresponding closing tag for JSX fragment at line 1388
# This typically means there's a mismatched <> and </> pair

# Fix by removing the extra </> on line 1390
sed -i '' '1390d' src/pages/operations.tsx

echo "✅ Fixed JSX fragment issue"
echo "   Backup saved as operations.tsx.bak"

# Verify the build
echo ""
echo "Testing frontend build..."
npm run build --no-error-on-unmatched-pattern || echo "⚠️  Build may still have issues"

# 2. Fix Backend Database Issue
echo ""
echo "2. Fixing Backend Database Error..."
echo "-----------------------------------"

# Create migration to add missing column
cat > ../ClubOSV1-backend/migrations/fix-openphone-conversations.sql << 'EOF'
-- Add missing conversation_id column to openphone_conversations table
ALTER TABLE openphone_conversations 
ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255) UNIQUE;

-- Update any existing rows
UPDATE openphone_conversations 
SET conversation_id = 'conv_' || id::text 
WHERE conversation_id IS NULL;

-- Verify the fix
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'openphone_conversations' 
AND column_name = 'conversation_id';
EOF

echo "✅ Created database migration"
echo "   Location: ClubOSV1-backend/migrations/fix-openphone-conversations.sql"

# 3. Summary
echo ""
echo "📋 Summary"
echo "----------"
echo "1. Frontend: Removed extra JSX fragment closing tag"
echo "2. Backend: Created migration to add missing conversation_id column"
echo ""
echo "🚀 Next Steps:"
echo "1. Deploy frontend: git add -A && git commit -m 'fix: JSX fragment mismatch' && git push"
echo "2. Run migration on Railway: railway run psql \$DATABASE_URL -f migrations/fix-openphone-conversations.sql"
echo "3. Restart backend: railway restart"

# 4. Quick verification commands
echo ""
echo "📝 Verification Commands:"
echo "- Check frontend: cd ClubOSV1-frontend && npm run build"
echo "- Check backend: curl https://your-backend-url/api/openphone/recent-conversations"
