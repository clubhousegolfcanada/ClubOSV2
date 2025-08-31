#!/bin/bash

echo "=== FINAL Comprehensive API Fix ==="
echo ""

# Fix all remaining issues one by one
FILES_TO_FIX=(
  "src/components/achievements/CustomAchievementCreator.tsx"
  "src/components/admin/KnowledgeRouterPanel.tsx"
  "src/components/AIFeatureCard.tsx"
  "src/components/customer/CustomerNavigation.tsx"
  "src/components/customer/FriendRequests.tsx"
  "src/components/customer/LeaderboardList.tsx"
  "src/components/customer/ProfileAchievements.tsx"
  "src/components/customer/RecentChallenges.tsx"
  "src/components/dashboard/CommandShortcutBar.tsx"
  "src/components/dashboard/MessagesCard.tsx"
  "src/components/dashboard/MessagesCardEnhanced.tsx"
  "src/components/dashboard/MessagesCardV3.tsx"
  "src/components/dashboard/MessagesCardV3-fixed.tsx"
  "src/components/dashboard/MessagesCardV3-hover-fix.tsx"
  "src/components/dashboard/MessagesCardV3.backup.tsx"
  "src/components/dashboard/MiniInsightsPanel.tsx"
  "src/components/dashboard/RecentCustomers.tsx"
  "src/components/dashboard/SuggestedActions.tsx"
  "src/components/operations/ai/OperationsAICenter.tsx"
  "src/components/operations/analytics/OperationsAnalytics.tsx"
  "src/components/operations/dashboard/OperationsDashboard.tsx"
  "src/components/operations/dashboard/OperationsDashboardEnhanced.tsx"
  "src/components/operations/integrations/OperationsIntegrations.tsx"
  "src/components/operations/users/OperationsUsers.tsx"
  "src/components/TicketCenterOptimized.tsx"
  "src/components/UserDebugCheck.tsx"
  "src/hooks/usePushNotifications.ts"
  "src/pages/clubosboy.tsx"
  "src/pages/customer/challenges/create.tsx"
  "src/pages/debug-openphone.tsx"
  "src/pages/index.tsx"
  "src/pages/messages.tsx"
  "src/pages/messages-redesigned.tsx"
  "src/pages/public/clubosboy.tsx"
  "src/pages/settings/ai-prompts.tsx"
)

for file in "${FILES_TO_FIX[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing: $file"
    
    # Check if file already has http import
    if ! grep -q "import { http }" "$file"; then
      # Check what imports it has
      if grep -q "import.*axios" "$file"; then
        # Replace axios with http
        sed -i '' "s|import axios from 'axios';|import { http } from '@/api/http';|g" "$file"
      elif ! grep -q "import { http }" "$file"; then
        # Add http import at the top after first import
        sed -i '' "1,/^import/s|^import|import { http } from '@/api/http';\nimport|" "$file"
      fi
    fi
    
    # Remove any API_URL imports
    sed -i '' "/import.*API_URL.*from/d" "$file"
    
    # Fix all template literals with API_URL
    sed -i '' "s|\${API_URL}/||g" "$file"
    sed -i '' "s|API_URL + '||g" "$file"
    sed -i '' "s|' + API_URL||g" "$file"
    
    # Replace axios calls with http
    sed -i '' "s|axios\.get|http.get|g" "$file"
    sed -i '' "s|axios\.post|http.post|g" "$file"
    sed -i '' "s|axios\.put|http.put|g" "$file"
    sed -i '' "s|axios\.delete|http.delete|g" "$file"
    sed -i '' "s|axios\.patch|http.patch|g" "$file"
    sed -i '' "s|axios\.request|http.request|g" "$file"
    
    # Remove headers with Authorization
    perl -i -0pe 's/,\s*{\s*headers:\s*{\s*Authorization:[^}]*}\s*}//gs' "$file"
    perl -i -0pe 's/,\s*{\s*headers:\s*{\s*["\047]Authorization["\047]:[^}]*}\s*}//gs' "$file"
    
    echo "  ✓ Fixed"
  fi
done

echo ""
echo "=== Verification ==="
REMAINING=$(grep -r "axios\.\|API_URL" src --include="*.ts" --include="*.tsx" | grep -v "apiUrl.ts\|resolveApi.ts\|http.ts\|authenticatedRequest\|config/api" | wc -l)
echo "Remaining issues: $REMAINING"

if [ "$REMAINING" -gt 0 ]; then
  echo ""
  echo "Remaining references:"
  grep -r "axios\.\|API_URL" src --include="*.ts" --include="*.tsx" | grep -v "apiUrl.ts\|resolveApi.ts\|http.ts\|authenticatedRequest\|config/api" | head -20
fi