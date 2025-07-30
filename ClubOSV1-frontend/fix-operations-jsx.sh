#!/bin/bash
# Fix JSX fragment issue in operations.tsx

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

# Create a backup
cp operations.tsx operations.tsx.backup

# The error is at line 1388, column 21 - expected closing tag for JSX fragment
# Looking at the code structure, there's an extra </> closing tag

# Use sed to fix the specific issue
# The pattern shows there's a </> on line 1390 that should be removed
sed -i '' '1390s|</||g' operations.tsx

echo "✅ Fixed JSX fragment issue"
echo "Backup saved as operations.tsx.backup"

# Verify the fix
echo ""
echo "Verifying fragments are balanced..."
OPENING=$(grep -o "<>" operations.tsx | wc -l | tr -d ' ')
CLOSING=$(grep -o "</>" operations.tsx | wc -l | tr -d ' ')

if [ "$OPENING" -eq "$CLOSING" ]; then
    echo "✅ Fragments are now balanced: $OPENING opening, $CLOSING closing"
else
    echo "⚠️  Fragments may still be unbalanced: $OPENING opening, $CLOSING closing"
fi
