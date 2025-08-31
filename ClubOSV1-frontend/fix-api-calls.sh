#!/bin/bash

# Script to fix all direct axios API calls

echo "Fixing all direct axios API calls to use http client..."

# Fix compete.tsx
echo "Fixing compete.tsx..."
sed -i '' "s|import { API_URL } from '@/utils/apiUrl';||g" src/pages/customer/compete.tsx
sed -i '' "s|import axios from 'axios';|import { http } from '@/api/http';|g" src/pages/customer/compete.tsx
sed -i '' "s|axios\.get(\`\${API_URL}/|http.get(\`|g" src/pages/customer/compete.tsx
sed -i '' "s|axios\.post(\`\${API_URL}/|http.post(\`|g" src/pages/customer/compete.tsx
sed -i '' "s|axios\.put(\`\${API_URL}/|http.put(\`|g" src/pages/customer/compete.tsx
sed -i '' "s|axios\.delete(\`\${API_URL}/|http.delete(\`|g" src/pages/customer/compete.tsx
sed -i '' "s|/api/||g" src/pages/customer/compete.tsx
# Remove auth headers
perl -i -0pe 's/,\s*{\s*headers:\s*{\s*Authorization:[^}]+}\s*}//gs' src/pages/customer/compete.tsx

# Fix profile.tsx
echo "Fixing profile.tsx..."
sed -i '' "s|import { API_URL } from '@/utils/apiUrl';||g" src/pages/customer/profile.tsx
sed -i '' "s|import axios from 'axios';|import { http } from '@/api/http';|g" src/pages/customer/profile.tsx
sed -i '' "s|axios\.get(\`\${API_URL}/|http.get(\`|g" src/pages/customer/profile.tsx
sed -i '' "s|axios\.post(\`\${API_URL}/|http.post(\`|g" src/pages/customer/profile.tsx
sed -i '' "s|axios\.put(\`\${API_URL}/|http.put(\`|g" src/pages/customer/profile.tsx
sed -i '' "s|axios\.delete(\`\${API_URL}/|http.delete(\`|g" src/pages/customer/profile.tsx
sed -i '' "s|/api/||g" src/pages/customer/profile.tsx
# Remove auth headers
perl -i -0pe 's/,\s*{\s*headers:\s*{\s*Authorization:[^}]+}\s*}//gs' src/pages/customer/profile.tsx

# Fix authenticatedRequest.ts
echo "Fixing authenticatedRequest.ts..."
sed -i '' "s|import { API_URL } from '@/utils/apiUrl';||g" src/utils/authenticatedRequest.ts
sed -i '' "s|import axios from 'axios';|import { http } from '@/api/http';|g" src/utils/authenticatedRequest.ts
sed -i '' "s|\`\${API_URL}\${url}\`|url|g" src/utils/authenticatedRequest.ts
sed -i '' "s|axios\.request|http.request|g" src/utils/authenticatedRequest.ts

echo "Done fixing API calls!"