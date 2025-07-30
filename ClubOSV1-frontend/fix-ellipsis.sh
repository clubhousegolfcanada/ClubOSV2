#!/bin/bash
# Fix the ellipsis issue in operations.tsx

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

# Backup the file
cp operations.tsx operations.tsx.backup

echo "🔧 Fixing ellipsis characters in operations.tsx..."

# Fix 1: Replace any ellipsis in imports
# The user mentioned "Trash2…ght" which should be "Trash2, ChevronRight"
sed -i '' 's/Trash2…ght/Trash2, ChevronRight/g' operations.tsx

# Fix 2: Remove any standalone ellipsis in type definitions
# Replace any line that just has "…" with nothing
sed -i '' '/^[[:space:]]*…[[:space:]]*$/d' operations.tsx

# Fix 3: Replace any Unicode ellipsis with three dots
sed -i '' 's/…/.../g' operations.tsx

# Fix 4: Clean up any broken imports
# Ensure the lucide-react import is complete
sed -i '' '/import.*from.*lucide-react/,/}/s/…/, /g' operations.tsx

echo "✅ Fixed ellipsis issues"

# Verify the fix
echo ""
echo "Verifying no ellipsis remain:"
if grep -q "…" operations.tsx; then
    echo "⚠️  Still found ellipsis characters:"
    grep -n "…" operations.tsx
else
    echo "✅ No ellipsis characters found"
fi

# Show the imports to verify they're correct
echo ""
echo "Current imports from lucide-react:"
grep -A20 "from 'lucide-react'" operations.tsx | head -25

echo ""
echo "🎯 Next step: Try building again with 'npm run build'"
