#!/bin/bash

echo "🔧 Fixing double /api/ issue in frontend code..."

# Count before
BEFORE_COUNT=$(grep -r "\${API_URL}/api/" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ClubOSV1-frontend/src | wc -l | tr -d ' ')
echo "Found $BEFORE_COUNT occurrences of double /api/ pattern"

# Fix all occurrences
find ClubOSV1-frontend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\${API_URL}\/api\//\${API_URL}\//g' {} +

# Count after
AFTER_COUNT=$(grep -r "\${API_URL}/api/" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ClubOSV1-frontend/src | wc -l | tr -d ' ')
echo "After fix: $AFTER_COUNT occurrences remaining"

# Also fix any axios.get, axios.post, etc. patterns with template literals
echo "🔧 Fixing template literal patterns..."
find ClubOSV1-frontend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/`\${API_URL}\/api\//`\${API_URL}\//g' {} +

# Show summary
FIXED=$((BEFORE_COUNT - AFTER_COUNT))
echo "✅ Fixed $FIXED occurrences"

# Show a few examples of the changes
echo ""
echo "📋 Sample of fixed files:"
git diff --name-only | head -5