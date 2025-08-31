#!/bin/bash

echo "🔧 Properly fixing API paths in frontend code..."

# The API URL should NOT have /api at the end
# But our API calls SHOULD include /api/ in the path

# Count current state
CURRENT_COUNT=$(grep -r "\${API_URL}/" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ClubOSV1-frontend/src | grep -v "/api/" | wc -l | tr -d ' ')
echo "Found $CURRENT_COUNT occurrences that need /api/ added back"

# Fix all occurrences - add /api/ back
find ClubOSV1-frontend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec sed -i '' 's/`\${API_URL}\//`\${API_URL}\/api\//g' {} +

# Count after
AFTER_COUNT=$(grep -r "\${API_URL}/api/" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" ClubOSV1-frontend/src | wc -l | tr -d ' ')
echo "After fix: $AFTER_COUNT occurrences with /api/"

echo "✅ Fixed API paths - now using \${API_URL}/api/ pattern"
echo ""
echo "📋 Configuration:"
echo "- API_URL should be: https://clubosv2-production.up.railway.app (NO /api suffix)"
echo "- API calls should be: \${API_URL}/api/endpoint"