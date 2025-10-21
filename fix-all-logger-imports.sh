#!/bin/bash

echo "🔧 Fixing all missing logger imports..."

# Backend script files
echo "📦 Adding logger to backend script files..."

# Scripts that need logger with relative path ../utils/logger
cat << 'EOF' | while read file; do
ClubOSV1-backend/src/scripts/cleanup-patterns.ts
ClubOSV1-backend/src/scripts/initialize-white-label-data.ts
ClubOSV1-backend/src/scripts/populate-white-label-inventory.ts
ClubOSV1-backend/src/scripts/run-rank-tier-migration.ts
ClubOSV1-backend/src/scripts/run-white-label-migration.ts
EOF
  if [ -f "$file" ]; then
    if ! grep -q "import.*logger" "$file"; then
      echo "  Fixing $file"
      # Add after first import line
      sed -i '' '1a\
import { logger } from '"'"'../utils/logger'"'"';
' "$file"
    fi
  fi
done

# Services that need logger
echo "📦 Adding logger to service files..."
cat << 'EOF' | while read file; do
ClubOSV1-backend/src/services/achievementService.ts
ClubOSV1-backend/src/services/ninjaone.ts
EOF
  if [ -f "$file" ]; then
    if ! grep -q "import.*logger" "$file"; then
      echo "  Fixing $file"
      sed -i '' '1a\
import { logger } from '"'"'../utils/logger'"'"';
' "$file"
    fi
  fi
done

# Test files that need logger
echo "📦 Adding logger to test files..."
cat << 'EOF' | while read file; do
ClubOSV1-backend/src/test/fix-mike-messages.ts
ClubOSV1-backend/src/test/test-gift-card-automation.ts
EOF
  if [ -f "$file" ]; then
    if ! grep -q "import.*logger" "$file"; then
      echo "  Fixing $file"
      sed -i '' '1a\
import { logger } from '"'"'../utils/logger'"'"';
' "$file"
    fi
  fi
done

# Utils that need logger
echo "📦 Adding logger to utils files..."
cat << 'EOF' | while read file; do
ClubOSV1-backend/src/utils/BaseController.ts
ClubOSV1-backend/src/utils/db-pool.ts
ClubOSV1-backend/src/utils/migrationRunner.ts
ClubOSV1-backend/src/utils/sentry.ts
EOF
  if [ -f "$file" ]; then
    if ! grep -q "import.*logger" "$file"; then
      echo "  Fixing $file"
      # For utils, use relative import from same directory
      sed -i '' '1a\
import { logger } from '"'"'./logger'"'"';
' "$file"
    fi
  fi
done

echo "✅ Backend logger imports fixed!"

# Now fix frontend files
echo "📱 Adding logger to frontend files..."

cat << 'EOF' | while read file; do
ClubOSV1-frontend/src/components/booking/CustomerSearchModal.tsx
ClubOSV1-frontend/src/components/booking/forms/ChangeManagement.tsx
ClubOSV1-frontend/src/components/booking/locations/LocationNoticeManager.tsx
ClubOSV1-frontend/src/components/booking/locations/LocationVisibilityToggle.tsx
ClubOSV1-frontend/src/components/booking/locations/NoticeDisplay.tsx
ClubOSV1-frontend/src/components/booking/multi/FavoriteSimulator.tsx
ClubOSV1-frontend/src/components/booking/multi/GroupBookingCoordinator.tsx
ClubOSV1-frontend/src/components/booking/multi/MultiSimulatorSelector.tsx
ClubOSV1-frontend/src/components/booking/selectors/DurationPicker.tsx
ClubOSV1-frontend/src/components/booking/SmartUpsellPopup.tsx
ClubOSV1-frontend/src/components/operations/checklists/ChecklistsAdminComponent.tsx
ClubOSV1-frontend/src/components/operations/integrations/ReceiptExportCard.tsx
ClubOSV1-frontend/src/components/operations/patterns/PatternsStatsAndSettings.tsx
ClubOSV1-frontend/src/components/operations/white-label/WhiteLabelPlanner.tsx
ClubOSV1-frontend/src/pages/bookings.tsx
ClubOSV1-frontend/src/services/booking/bookingConfigService.ts
ClubOSV1-frontend/src/services/booking/locationNoticeService.ts
EOF
  if [ -f "$file" ]; then
    if ! grep -q "import.*logger" "$file"; then
      echo "  Fixing $file"
      # Add after first import
      line_num=$(grep -n "^import" "$file" | head -1 | cut -d: -f1)
      if [ ! -z "$line_num" ]; then
        sed -i '' "${line_num}a\\
import logger from '@/services/logger';
" "$file"
      fi
    fi
  fi
done

echo "✅ Frontend logger imports fixed!"
echo "🎉 All logger imports should now be fixed!"