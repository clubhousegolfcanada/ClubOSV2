#!/bin/bash

echo "Fixing ALL instances of \${API_URL}/api to just \${API_URL}..."

# Find all TypeScript/JavaScript files and fix the pattern
find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/\${API_URL}\/api/\${API_URL}/g' {} \;

# Count how many instances we fixed
echo "Checking remaining instances..."
remaining=$(grep -r '\${API_URL}/api' src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
echo "Remaining instances: $remaining"

echo "Fix complete!"
