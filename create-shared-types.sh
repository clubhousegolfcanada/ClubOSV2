#!/bin/bash

# Generate TypeScript types from your backend API for frontend consumption
echo "Generating shared types from backend..."

# 1. Extract all interface/type definitions from backend
find ./ClubOSV1-backend/src -name "*.ts" -exec grep -h "^export \(interface\|type\)" {} \; > ./shared-types.ts

# 2. Create a types package without full monorepo
mkdir -p shared/types
cat > shared/types/package.json << 'EOF'
{
  "name": "@clubos/types",
  "version": "1.0.0",
  "main": "index.ts",
  "types": "index.ts"
}
EOF

# 3. Move generated types
mv shared-types.ts shared/types/index.ts

# 4. Link to frontend
cd ClubOSV1-frontend
npm link ../shared/types
cd ..

echo "✅ Shared types created without full monorepo conversion"
echo "Import in frontend: import { UserType } from '@clubos/types'"
