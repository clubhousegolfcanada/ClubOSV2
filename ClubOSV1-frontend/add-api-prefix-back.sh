#!/bin/bash

echo "Adding /api prefix back to all API calls..."

# Find all TypeScript/JavaScript files and add /api prefix back
find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\${API_URL}\//\${API_URL}\/api\//g' {} \;

# Count how many instances we fixed
echo "Checking instances after fix..."
fixed=$(grep -r '\${API_URL}/api/' src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
echo "Fixed instances: $fixed"

echo "Fix complete!"
