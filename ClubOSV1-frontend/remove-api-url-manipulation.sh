#!/bin/bash

echo "Removing API_URL manipulation logic from all files..."

# Find all files with the API_URL manipulation logic and remove it
find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | while read file; do
  # Check if file contains the pattern
  if grep -q "if (API_URL.endsWith('/api'))" "$file"; then
    echo "Processing: $file"
    
    # Remove the entire block including the comment and if statement (typically 4-5 lines)
    # This removes the comment line, the if statement, the slice line, and the closing brace
    sed -i '' '/\/\/ Fix for double \/api\/ issue/,/^}/d' "$file"
    sed -i '' '/\/\/ Remove \/api from the end/,/^}/d' "$file"
    
    # Also remove standalone endsWith checks
    sed -i '' '/if (API_URL\.endsWith.*\/api/,+2d' "$file"
    sed -i '' '/if (ENV_API_URL\.endsWith.*\/api/,+2d' "$file"
  fi
done

echo "Checking remaining instances..."
remaining=$(grep -r "endsWith.*\/api" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | wc -l)
echo "Remaining endsWith('/api') instances: $remaining"

echo "Fix complete!"
