#!/bin/bash

# Fix frontend files that need logger imports
echo "🔄 Adding logger imports to frontend files..."

# List of files that need the import
files=(
  "ClubOSV1-frontend/src/components/booking/CustomerSearchModal.tsx"
  "ClubOSV1-frontend/src/components/booking/forms/ChangeManagement.tsx"
  "ClubOSV1-frontend/src/components/booking/locations/LocationNoticeManager.tsx"
  "ClubOSV1-frontend/src/components/booking/locations/LocationVisibilityToggle.tsx"
  "ClubOSV1-frontend/src/components/booking/locations/NoticeDisplay.tsx"
  "ClubOSV1-frontend/src/components/booking/multi/FavoriteSimulator.tsx"
  "ClubOSV1-frontend/src/components/booking/multi/GroupBookingCoordinator.tsx"
  "ClubOSV1-frontend/src/components/booking/multi/MultiSimulatorSelector.tsx"
  "ClubOSV1-frontend/src/components/booking/selectors/DurationPicker.tsx"
  "ClubOSV1-frontend/src/components/booking/SmartUpsellPopup.tsx"
  "ClubOSV1-frontend/src/components/operations/checklists/ChecklistsAdminComponent.tsx"
  "ClubOSV1-frontend/src/components/operations/integrations/ReceiptExportCard.tsx"
  "ClubOSV1-frontend/src/components/operations/patterns/PatternsStatsAndSettings.tsx"
  "ClubOSV1-frontend/src/components/operations/white-label/WhiteLabelPlanner.tsx"
  "ClubOSV1-frontend/src/pages/bookings.tsx"
  "ClubOSV1-frontend/src/services/booking/bookingConfigService.ts"
  "ClubOSV1-frontend/src/services/booking/locationNoticeService.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if logger is already imported
    if ! grep -q "import.*logger" "$file"; then
      echo "  Adding logger import to $file"

      # Add import after the last import line
      # Find the line with the last import statement
      last_import_line=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

      if [ ! -z "$last_import_line" ]; then
        # Add logger import after the last import
        sed -i '' "${last_import_line}a\\
import logger from '@/services/logger';
" "$file"
      fi
    fi
  fi
done

echo "✅ Logger imports added to frontend files!"