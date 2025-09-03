#!/bin/bash

# Migrate to monorepo structure
echo "Converting ClubOSV1 to proper monorepo..."

# 1. Install pnpm globally if needed
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm
fi

# 2. Create proper directory structure
mkdir -p apps
mkdir -p packages/database
mkdir -p packages/shared
mkdir -p packages/config

# 3. Move existing projects
echo "Restructuring directories..."
mv ClubOSV1-backend apps/backend 2>/dev/null || echo "Backend already moved"
mv ClubOSV1-frontend apps/frontend 2>/dev/null || echo "Frontend already moved"

# 4. Update package.json names to match workspace
cd apps/backend && \
  jq '.name = "@clubos/backend"' package.json > tmp.json && \
  mv tmp.json package.json

cd ../frontend && \
  jq '.name = "@clubos/frontend"' package.json > tmp.json && \
  mv tmp.json package.json

cd ../..

# 5. Create shared Prisma package
cat > packages/database/package.json << 'EOF'
{
  "name": "@clubos/database",
  "version": "1.0.0",
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "generate": "prisma generate",
    "push": "prisma db push",
    "migrate": "prisma migrate dev"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0"
  },
  "devDependencies": {
    "prisma": "^5.7.0",
    "typescript": "^5.3.3"
  }
}
EOF

# 6. Move Prisma schema to shared package
if [ -d "apps/backend/prisma" ]; then
  cp -r apps/backend/prisma packages/database/
  echo "export * from '@prisma/client'" > packages/database/index.ts
fi

# 7. Update root package.json for workspace
cat > package.json << 'EOF'
{
  "name": "clubos",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "db:generate": "pnpm --filter @clubos/database generate",
    "db:push": "pnpm --filter @clubos/database push",
    "db:migrate": "pnpm --filter @clubos/database migrate"
  },
  "devDependencies": {
    "turbo": "latest",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3"
  },
  "packageManager": "pnpm@8.6.0"
}
EOF

# 8. Create Turborepo config
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "deploy": {
      "dependsOn": ["build", "test"]
    }
  }
}
EOF

# 9. Update workspace config
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

echo "✅ Monorepo structure created"
echo ""
echo "Next steps:"
echo "1. Run: pnpm install"
echo "2. Update imports in backend to use @clubos/database"
echo "3. Run: pnpm db:generate"
echo "4. Run: pnpm dev"
