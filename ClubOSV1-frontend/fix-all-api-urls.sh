#!/bin/bash

echo "=== Comprehensive API_URL Fix Script ==="
echo "This will fix ALL remaining API_URL references in the codebase"
echo ""

# Find all files with API_URL references
echo "Finding all files with API_URL references..."
FILES=$(grep -r "API_URL" src --include="*.tsx" --include="*.ts" | grep -v "apiUrl.ts" | grep -v "resolveApi.ts" | cut -d: -f1 | sort | uniq)

echo "Found $(echo "$FILES" | wc -l) files to fix"
echo ""

for file in $FILES; do
  echo "Processing: $file"
  
  # Check if file already imports http
  if grep -q "import { http }" "$file"; then
    echo "  ✓ Already has http import"
  else
    # Check if file imports axios and API_URL
    if grep -q "import.*axios" "$file" && grep -q "import.*API_URL" "$file"; then
      # Replace axios import with http
      sed -i '' "s|import axios from 'axios';|import { http } from '@/api/http';|g" "$file"
      # Remove API_URL import
      sed -i '' "/import.*API_URL.*from.*apiUrl/d" "$file"
      echo "  + Added http import, removed axios and API_URL"
    elif grep -q "import.*API_URL" "$file"; then
      # Just remove API_URL and add http
      sed -i '' "s|import { API_URL } from '@/utils/apiUrl';|import { http } from '@/api/http';|g" "$file"
      echo "  + Replaced API_URL import with http"
    fi
  fi
  
  # Fix all API_URL template literals
  # Pattern: ${API_URL}/something -> something
  sed -i '' "s|\`\${API_URL}/|\`|g" "$file"
  
  # Fix axios.get/post/put/delete/patch calls
  sed -i '' "s|axios\.get|http.get|g" "$file"
  sed -i '' "s|axios\.post|http.post|g" "$file"
  sed -i '' "s|axios\.put|http.put|g" "$file"
  sed -i '' "s|axios\.delete|http.delete|g" "$file"
  sed -i '' "s|axios\.patch|http.patch|g" "$file"
  
  # Remove Authorization headers (http client handles this)
  # This is complex, so we'll do it with perl
  perl -i -0pe 's/,\s*{\s*headers:\s*{\s*Authorization:[^}]+}\s*}//gs' "$file"
  perl -i -0pe 's/,\s*{\s*headers:\s*{\s*["\047]Authorization["\047]:[^}]+}\s*}//gs' "$file"
  
  echo "  ✓ Fixed API calls"
done

echo ""
echo "=== Fix Complete ==="
echo "Now checking for any remaining issues..."

# Final check
REMAINING=$(grep -r "API_URL" src --include="*.tsx" --include="*.ts" | grep -v "apiUrl.ts" | grep -v "resolveApi.ts" | grep -v "//" | wc -l)
echo "Remaining API_URL references: $REMAINING"

if [ "$REMAINING" -gt 0 ]; then
  echo ""
  echo "Remaining references that may need manual review:"
  grep -r "API_URL" src --include="*.tsx" --include="*.ts" | grep -v "apiUrl.ts" | grep -v "resolveApi.ts" | grep -v "//" | head -10
fi