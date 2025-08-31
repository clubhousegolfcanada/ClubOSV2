#!/bin/bash

# This script fixes the double /api/api/ issue by:
# 1. Changing ${API_URL}/api to ${API_URL}/api (API_URL should already be the full API URL with /api)
# 2. The issue is that API_URL doesn't include /api, so we need to keep the pattern as is
# 3. BUT we need to ensure API_URL DOES include /api in the export

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend

echo "=== Fixing the root cause in apiUrl.ts ==="
# The real fix: Make API_URL include /api
cat > src/utils/apiUrl.ts << 'EOF'
/**
 * Simple API URL configuration
 * FIXED: API_URL now includes /api to prevent double /api/api/ issue
 */

// Get base URL from environment (without /api)
const ENV_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Export the base URL (for non-API endpoints if needed)
export const BASE_URL = ENV_BASE_URL;

// Export the API URL WITH /api suffix - all calls expect this to include /api
export const API_URL = ENV_BASE_URL + '/api';
EOF

echo "✅ Fixed apiUrl.ts - API_URL now includes /api"

echo ""
echo "=== Now we need to remove /api from all the API calls since API_URL includes it ==="
echo ""

# Find all files that use ${API_URL}/api pattern
files=$(grep -r "\${API_URL}/api" src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -l)

count=0
for file in $files; do
    echo "Processing: $file"
    # Replace ${API_URL}/api with just ${API_URL}
    sed -i '' 's/\${API_URL}\/api/\${API_URL}/g' "$file"
    count=$((count + 1))
done

echo ""
echo "✅ Fixed $count files by removing /api from API calls"

echo ""
echo "=== Fixing apiClient.ts to use correct paths ==="
# Fix apiClient paths that use /api prefix
files=$(grep -r "apiClient\.\(get\|post\|put\|delete\|patch\)('/api" src/ --include="*.ts" --include="*.tsx" -l)

for file in $files; do
    echo "Processing apiClient calls in: $file"
    # Remove /api prefix from apiClient calls since baseURL already includes it
    sed -i '' "s/apiClient\.\(get\|post\|put\|delete\|patch\)('\/api/apiClient.\1('/g" "$file"
done

echo ""
echo "✅ Fixed apiClient calls to not duplicate /api"

echo ""
echo "=== Summary ==="
echo "1. API_URL now includes /api suffix"
echo "2. Removed /api from all \${API_URL}/api patterns"
echo "3. Fixed apiClient calls to not include /api prefix"
echo ""
echo "The double /api/api/ issue should now be completely resolved!"