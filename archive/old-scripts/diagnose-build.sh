#!/bin/bash
# Diagnose the actual build error

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend

echo "🔍 Diagnosing Build Error..."
echo "=========================="

# Check for Unicode ellipsis characters
echo ""
echo "1. Checking for ellipsis characters (…):"
if grep -n "…" src/pages/operations.tsx; then
    echo "Found ellipsis characters!"
else
    echo "No Unicode ellipsis found"
fi

# Check for specific patterns mentioned in the error
echo ""
echo "2. Checking imports around lucide-react:"
grep -A5 -B5 "from 'lucide-react'" src/pages/operations.tsx | head -20

# Check the specific line mentioned in error (1388)
echo ""
echo "3. Content around line 1388:"
sed -n '1385,1392p' src/pages/operations.tsx | nl -v 1385

# Try to build and capture the exact error
echo ""
echo "4. Attempting build to get exact error:"
npm run build 2>&1 | grep -A10 -B10 "error:" | head -30

# Check for any non-ASCII characters
echo ""
echo "5. Checking for non-ASCII characters:"
if LC_ALL=C grep -n '[^ -~]' src/pages/operations.tsx | head -10; then
    echo "Found non-ASCII characters (shown above)"
else
    echo "No non-ASCII characters found"
fi

# Create a clean version without any potential issues
echo ""
echo "6. Creating cleaned version..."
# Remove any Unicode ellipsis and fix common issues
sed 's/…/\.\.\./g' src/pages/operations.tsx > src/pages/operations_cleaned.tsx

echo ""
echo "✅ Diagnostic complete. Check operations_cleaned.tsx if needed."
