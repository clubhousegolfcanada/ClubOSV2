#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

git add -A
git commit -m "fix: add missing JSX fragment closing tag in operations.tsx

- Add missing </> before ternary operator at line 1385
- Fixes TypeScript compilation error: ')' expected
- Properly closes JSX fragment in Knowledge section

This completes the fix for the frontend build error."

echo "✅ Committed fix!"
git log -1 --oneline
