#!/bin/bash

# Script to replace console.log statements with proper logger calls
# Run from the CLUBOSV1 directory

echo "🔄 Starting console.log replacement..."

# Backend replacements
echo "📦 Processing backend files..."

# Count before
BACKEND_BEFORE=$(grep -r "console\." ClubOSV1-backend/src --include="*.ts" | wc -l)
echo "  Found $BACKEND_BEFORE console statements in backend"

# Replace console.log with logger.debug in backend
find ClubOSV1-backend/src -name "*.ts" -type f -exec sed -i '' 's/console\.log(/logger.debug(/g' {} +
find ClubOSV1-backend/src -name "*.ts" -type f -exec sed -i '' 's/console\.error(/logger.error(/g' {} +
find ClubOSV1-backend/src -name "*.ts" -type f -exec sed -i '' 's/console\.warn(/logger.warn(/g' {} +
find ClubOSV1-backend/src -name "*.ts" -type f -exec sed -i '' 's/console\.info(/logger.info(/g' {} +

# Frontend replacements
echo "📱 Processing frontend files..."

# Count before
FRONTEND_BEFORE=$(grep -r "console\." ClubOSV1-frontend/src --include="*.ts*" | wc -l)
echo "  Found $FRONTEND_BEFORE console statements in frontend"

# Replace console.log with logger.debug in frontend
find ClubOSV1-frontend/src -name "*.tsx" -type f -exec sed -i '' 's/console\.log(/logger.debug(/g' {} +
find ClubOSV1-frontend/src -name "*.tsx" -type f -exec sed -i '' 's/console\.error(/logger.error(/g' {} +
find ClubOSV1-frontend/src -name "*.tsx" -type f -exec sed -i '' 's/console\.warn(/logger.warn(/g' {} +
find ClubOSV1-frontend/src -name "*.tsx" -type f -exec sed -i '' 's/console\.info(/logger.info(/g' {} +

find ClubOSV1-frontend/src -name "*.ts" -type f -exec sed -i '' 's/console\.log(/logger.debug(/g' {} +
find ClubOSV1-frontend/src -name "*.ts" -type f -exec sed -i '' 's/console\.error(/logger.error(/g' {} +
find ClubOSV1-frontend/src -name "*.ts" -type f -exec sed -i '' 's/console\.warn(/logger.warn(/g' {} +
find ClubOSV1-frontend/src -name "*.ts" -type f -exec sed -i '' 's/console\.info(/logger.info(/g' {} +

# Count after
BACKEND_AFTER=$(grep -r "console\." ClubOSV1-backend/src --include="*.ts" | wc -l)
FRONTEND_AFTER=$(grep -r "console\." ClubOSV1-frontend/src --include="*.ts*" | wc -l)

echo ""
echo "✅ Replacement complete!"
echo "  Backend: $BACKEND_BEFORE → $BACKEND_AFTER console statements"
echo "  Frontend: $FRONTEND_BEFORE → $FRONTEND_AFTER console statements"
echo ""
echo "⚠️  IMPORTANT: You need to manually:"
echo "  1. Add 'import logger from './utils/logger';' to backend files that don't have it"
echo "  2. Add 'import logger from '@/services/logger';' to frontend files that don't have it"
echo "  3. Review for any sensitive data that shouldn't be logged"
echo "  4. Test the application to ensure nothing broke"
echo ""
echo "🔍 Files that might need logger imports:"
echo "Backend files:"
grep -l "logger\." ClubOSV1-backend/src/**/*.ts 2>/dev/null | while read file; do
  if ! grep -q "import.*logger" "$file"; then
    echo "  - $file"
  fi
done | head -10

echo "Frontend files:"
grep -l "logger\." ClubOSV1-frontend/src/**/*.ts* 2>/dev/null | while read file; do
  if ! grep -q "import.*logger" "$file"; then
    echo "  - $file"
  fi
done | head -10