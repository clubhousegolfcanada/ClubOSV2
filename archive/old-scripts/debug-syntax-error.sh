#!/bin/bash
# Debug the syntax error around line 1385

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

echo "Lines 1380-1390 of operations.tsx:"
sed -n '1380,1390p' operations.tsx | nl -v 1380

echo ""
echo "Checking for mismatched parentheses/brackets:"
echo "Opening parentheses: $(grep -o '(' operations.tsx | wc -l)"
echo "Closing parentheses: $(grep -o ')' operations.tsx | wc -l)"
echo "Opening JSX tags <>: $(grep -o '<>' operations.tsx | wc -l)"
echo "Closing JSX tags </>: $(grep -o '</>' operations.tsx | wc -l)"
echo "Opening braces {: $(grep -o '{' operations.tsx | wc -l)"
echo "Closing braces }: $(grep -o '}' operations.tsx | wc -l)"

echo ""
echo "Looking for pattern around error (line 1385):"
grep -n -A2 -B2 "</div>" operations.tsx | grep -E "138[0-9]"
