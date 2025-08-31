#!/bin/bash

# Files that need the API_URL import
files=(
  "./src/contexts/MessagesContext.tsx"
  "./src/utils/authenticatedRequest.ts"
  "./src/state/hooks.ts"
  "./src/components/ChecklistSystem.tsx"
  "./src/components/RecentMessages.tsx"
  "./src/components/UserDebugCheck.tsx"
  "./src/components/admin/KnowledgeRouterPanel.tsx"
  "./src/components/operations/dashboard/OperationsDashboard.tsx"
  "./src/components/operations/dashboard/OperationsDashboardEnhanced.tsx"
  "./src/components/operations/integrations/OperationsIntegrations.tsx"
  "./src/components/operations/ai/OperationsAICenter.tsx"
  "./src/components/operations/users/OperationsUsers.tsx"
  "./src/components/operations/analytics/OperationsAnalytics.tsx"
  "./src/components/dashboard/MessagesCardV3-fixed.tsx"
  "./src/components/dashboard/MessagesCardV3.tsx"
  "./src/components/dashboard/CommandShortcutBar.tsx"
  "./src/components/dashboard/MessagesCardV3-hover-fix.tsx"
  "./src/components/dashboard/SuggestedActions.tsx"
  "./src/components/dashboard/MiniInsightsPanel.tsx"
  "./src/components/dashboard/MessagesCard.tsx"
  "./src/components/dashboard/MessagesCardEnhanced.tsx"
  "./src/components/dashboard/MessagesCardV3.backup.tsx"
  "./src/components/dashboard/RecentCustomers.tsx"
  "./src/components/AIFeatureCard.tsx"
  "./src/components/OpenPhoneConversations.tsx"
  "./src/components/TicketCenterOptimized.tsx"
  "./src/components/customer/CustomerNavigation.tsx"
  "./src/components/customer/FriendRequests.tsx"
  "./src/components/customer/ProfileAchievements.tsx"
  "./src/components/customer/LeaderboardList.tsx"
  "./src/components/customer/RecentChallenges.tsx"
  "./src/hooks/usePushNotifications.ts"
  "./src/hooks/useMessageNotifications.ts"
  "./src/pages/index.tsx"
  "./src/pages/settings/ai-prompts.tsx"
  "./src/pages/messages-redesigned.tsx"
  "./src/pages/clubosboy.tsx"
  "./src/pages/public/clubosboy.tsx"
  "./src/pages/debug-openphone.tsx"
  "./src/pages/messages.tsx"
  "./src/pages/customer/challenges/create.tsx"
  "./src/pages/customer/challenges/[id].tsx"
  "./src/pages/customer/profile.tsx"
  "./src/pages/customer/compete.tsx"
  "./src/services/logger.ts"
  "./src/services/userSettings.ts"
)

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if file already has API_URL import
    if ! grep -q "import.*API_URL.*from.*apiUrl" "$file"; then
      echo "Processing $file..."
      
      # Find the first import line to add our import after it
      first_import_line=$(grep -n "^import " "$file" | head -1 | cut -d: -f1)
      
      if [ -n "$first_import_line" ]; then
        # Add the import after the first import
        sed -i '' "${first_import_line}a\\
import { API_URL } from '@/utils/apiUrl';
" "$file"
        echo "✓ Added API_URL import to $file"
      else
        # No imports found, add at the beginning
        sed -i '' "1i\\
import { API_URL } from '@/utils/apiUrl';\\
" "$file"
        echo "✓ Added API_URL import at beginning of $file"
      fi
    else
      echo "✓ $file already has API_URL import"
    fi
  else
    echo "⚠ File not found: $file"
  fi
done

echo "Done! Added API_URL imports to all files."