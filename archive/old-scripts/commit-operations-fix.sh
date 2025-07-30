#!/bin/bash
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

# Run the fix script first
chmod +x fix-operations-build.sh
./fix-operations-build.sh

# Commit all changes
git add -A
git commit -m "fix: resolve operations.tsx build errors and add refactoring plan

Immediate fixes:
- Fix invalid ellipsis character in lucide-react imports
- Clean up import statement formatting
- Remove any Unicode ellipsis characters
- Ensure all required icons are properly imported

Documentation:
- Add comprehensive operations.tsx audit findings
- Create detailed refactoring plan (OPERATIONS_REFACTOR_PLAN.md)
- Address type safety, performance, and maintainability issues
- Plan component extraction and state management improvements

Next steps:
- Extract UserManagement, SystemConfiguration, and AnalyticsPanel components
- Replace 'any' types with proper interfaces
- Implement error boundaries and accessibility improvements
- Add test coverage with data-testid attributes

This fixes the immediate build error. Full refactoring to follow based on audit recommendations."

echo "✅ Changes committed!"
git log -1 --oneline
