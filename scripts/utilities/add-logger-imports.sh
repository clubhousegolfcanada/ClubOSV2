#!/bin/bash

# Script to add logger imports to files that need them
echo "🔄 Adding logger imports to files that need them..."

# Backend files that need logger import
backend_files=(
  "ClubOSV1-backend/src/routes/setup.ts"
  "ClubOSV1-backend/src/scripts/cleanup-patterns.ts"
  "ClubOSV1-backend/src/scripts/initialize-white-label-data.ts"
  "ClubOSV1-backend/src/scripts/populate-white-label-inventory.ts"
  "ClubOSV1-backend/src/scripts/run-rank-tier-migration.ts"
  "ClubOSV1-backend/src/scripts/run-white-label-migration.ts"
  "ClubOSV1-backend/src/services/achievementService.ts"
  "ClubOSV1-backend/src/services/ninjaone.ts"
  "ClubOSV1-backend/src/test/fix-mike-messages.ts"
  "ClubOSV1-backend/src/test/test-gift-card-automation.ts"
  "ClubOSV1-backend/src/utils/BaseController.ts"
  "ClubOSV1-backend/src/utils/db-pool.ts"
  "ClubOSV1-backend/src/utils/migrationRunner.ts"
  "ClubOSV1-backend/src/utils/sentry.ts"
)

for file in "${backend_files[@]}"; do
  if [ -f "$file" ]; then
    # Check if logger is already imported
    if ! grep -q "import.*logger" "$file"; then
      echo "  Adding logger import to $file"

      # Add the import after the first import statement
      if grep -q "^import" "$file"; then
        # Find the line number of the last import statement
        last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

        # Insert the logger import after the last import
        sed -i '' "${last_import_line}a\\
import { logger } from '../utils/logger';
" "$file"
      else
        # No imports found, add at the beginning
        sed -i '' "1i\\
import { logger } from '../utils/logger';
" "$file"
      fi
    fi
  fi
done

# Special case for files in different directory structures
special_files=(
  "ClubOSV1-backend/src/test/fix-mike-messages.ts"
  "ClubOSV1-backend/src/test/test-gift-card-automation.ts"
)

for file in "${special_files[@]}"; do
  if [ -f "$file" ]; then
    # Fix the import path for test files
    sed -i '' "s|import { logger } from '../utils/logger';|import { logger } from '../utils/logger';|g" "$file"
  fi
done

echo "✅ Logger imports added successfully!"