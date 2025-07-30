#!/bin/bash
# Script to find and fix JSX fragment mismatch in operations.tsx

echo "🔍 Searching for JSX fragment issue in operations.tsx..."

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

# Count opening and closing fragments
OPENING_FRAGMENTS=$(grep -o "<>" operations.tsx | wc -l)
CLOSING_FRAGMENTS=$(grep -o "</>" operations.tsx | wc -l)

echo "Opening fragments (<>): $OPENING_FRAGMENTS"
echo "Closing fragments (</>): $CLOSING_FRAGMENTS"

if [ $OPENING_FRAGMENTS -ne $CLOSING_FRAGMENTS ]; then
    echo "❌ Fragment mismatch detected!"
    echo "Difference: $((OPENING_FRAGMENTS - CLOSING_FRAGMENTS))"
    
    # Show lines around 1388
    echo ""
    echo "Lines around 1388:"
    sed -n '1380,1395p' operations.tsx | nl -v 1380
    
    # Look for the specific pattern around line 1388
    echo ""
    echo "Searching for mismatched closing tags..."
    grep -n "</>" operations.tsx | grep -E "138[0-9]"
else
    echo "✅ Fragments appear balanced"
fi
