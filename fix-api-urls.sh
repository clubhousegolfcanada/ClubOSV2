#!/bin/bash

# Fix all instances where API_URL adds /api in the fallback
cd ClubOSV1-frontend/src

# Replace the pattern in all files
find . -type f -name "*.ts" -o -name "*.tsx" | while read file; do
  if grep -q "process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'" "$file"; then
    echo "Fixing: $file"
    sed -i '' "s|process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'|process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'|g" "$file"
  fi
done

echo "All API URL references have been fixed!"