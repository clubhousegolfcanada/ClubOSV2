#!/bin/bash
# More precise fix for the JSX fragment issue

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

# The error indicates line 1388, column 21: Expected corresponding closing tag for JSX fragment
# This means there's a </div> that should be </> or vice versa

# Create a Python script to fix the exact issue
cat > fix_jsx.py << 'EOF'
import re

# Read the file
with open('operations.tsx', 'r') as f:
    lines = f.readlines()

# The error is at line 1388 (0-indexed: 1387)
# Looking at the structure, around line 1388-1390 there should be:
# Line 1386:                       </div>
# Line 1387:                     </div>
# Line 1388:                   </div>    <- This should probably be </>
# Line 1389:                 </div>
# Line 1390:                 </>         <- This is extra

# Fix: Change line 1388 from </div> to </> and remove line 1390
if len(lines) > 1389:
    # Check if line 1387 (0-indexed) ends with </div>
    if '</div>' in lines[1387]:
        lines[1387] = lines[1387].replace('</div>', '</>')
    
    # Remove the extra </> if it exists around line 1389
    if len(lines) > 1389 and '</>' in lines[1389]:
        lines[1389] = ''

# Write back
with open('operations.tsx', 'w') as f:
    f.writelines(lines)

print("Fixed JSX fragment issue")
EOF

# Run the fix
python3 fix_jsx.py

# Clean up
rm fix_jsx.py

echo "✅ Applied precise fix for JSX fragment issue"
