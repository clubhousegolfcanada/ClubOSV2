#!/bin/bash
# Fix the syntax error at line 1385

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

# Backup the file
cp operations.tsx operations.tsx.backup2

echo "Fixing syntax error at line 1385..."

# The error shows:
# Line 1385:                 </div>
# Line 1386:               ) : (
# 
# This suggests we need to add a closing </> before the ) : (

# Create a Python script to fix the exact issue
cat > fix_syntax.py << 'EOF'
with open('operations.tsx', 'r') as f:
    lines = f.readlines()

# Find the problematic area around line 1385
# Looking for </div> followed by ) : (
for i in range(len(lines) - 1):
    if i >= 1380 and i <= 1390:
        current = lines[i].strip()
        next_line = lines[i+1].strip() if i+1 < len(lines) else ""
        
        # If we find </div> followed by ) : (
        if '</div>' in current and ') : (' in next_line:
            print(f"Found issue at line {i+1}")
            # Insert </> before the ) : (
            lines[i+1] = lines[i+1].replace(') : (', '</>\n              ) : (')
            break

# Write back
with open('operations.tsx', 'w') as f:
    f.writelines(lines)

print("Fixed syntax error")
EOF

python3 fix_syntax.py
rm fix_syntax.py

echo "Done! The syntax error should be fixed."
echo ""
echo "Verification - lines 1380-1390:"
sed -n '1380,1390p' operations.tsx | nl -v 1380
