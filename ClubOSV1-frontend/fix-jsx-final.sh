#!/bin/bash
# Fix JSX structure issue causing build error

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

# The error at line 1385 suggests there's a missing closing tag
# Before the ternary operator ) : (

# Use sed to fix the specific line
# Add </> before the ) : ( pattern around line 1386
sed -i '' '1386s/) : (/<\/>\
              ) : (/' operations.tsx

echo "✅ Added missing </> closing tag before ternary operator"

# Alternative fix if the above doesn't work
# Sometimes the issue is the number of closing divs doesn't match opening divs
# Let's check the structure and fix it properly

cat > fix_jsx_structure.py << 'EOF'
import re

with open('operations.tsx', 'r') as f:
    content = f.read()

# Split into lines for analysis
lines = content.split('\n')

# Find the area around line 1385
print("Analyzing structure around line 1385...")
for i in range(1380, min(1390, len(lines))):
    print(f"{i+1}: {lines[i]}")

# The pattern shows we have:
# - Multiple closing </div> tags
# - Followed by ) : (
# This suggests we're closing a JSX expression but missing the fragment close

# Fix: Ensure there's a </> before ) : (
fixed_content = content

# Look for pattern where we have closing divs followed by ) : (
# and ensure there's a </> before it
pattern = r'(\s*</div>\s*\n\s*</div>\s*\n\s*</div>\s*\n)(\s*\) : \()'
replacement = r'\1              </>\n\2'

fixed_content = re.sub(pattern, replacement, fixed_content)

with open('operations.tsx', 'w') as f:
    f.write(fixed_content)

print("Fixed JSX structure")
EOF

python3 fix_jsx_structure.py
rm fix_jsx_structure.py

echo ""
echo "Verification - checking around line 1385:"
sed -n '1380,1390p' operations.tsx | nl -v 1380

echo ""
echo "✅ JSX structure fixed. Try building again."
