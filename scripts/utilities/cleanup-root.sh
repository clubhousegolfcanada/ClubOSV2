#!/bin/bash
# cleanup-clubosv1-root.sh

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Create archive directory with timestamp
ARCHIVE_DIR="archive/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ARCHIVE_DIR"

# Move old/completed files to archive
echo "→ Archiving completed/old files..."
mv CLEANUP_OPTIMIZATION_AUDIT.md "$ARCHIVE_DIR/" 2>/dev/null
mv TECHNICAL_AUDIT_REPORT.md "$ARCHIVE_DIR/" 2>/dev/null
mv DOCUMENTATION_VERIFICATION.md "$ARCHIVE_DIR/" 2>/dev/null
mv CLUBOS_REVIEW_FOR_JASON.md "$ARCHIVE_DIR/" 2>/dev/null
mv clubos-v1.0.0-deployment.tar.gz "$ARCHIVE_DIR/" 2>/dev/null
mv audit-clubos.sh "$ARCHIVE_DIR/" 2>/dev/null
mv cleanup-clubos.sh "$ARCHIVE_DIR/" 2>/dev/null
mv optimize-clubos.sh "$ARCHIVE_DIR/" 2>/dev/null
mv optimize-package.json "$ARCHIVE_DIR/" 2>/dev/null
mv add-indexes.sql "$ARCHIVE_DIR/" 2>/dev/null

# Create organized structure
echo "→ Organizing documentation..."
mkdir -p docs/setup
mkdir -p docs/deployment
mkdir -p docs/development

# Move docs to proper locations
mv SETUP_GUIDE.md docs/setup/ 2>/dev/null
mv DEPLOYMENT.md docs/deployment/ 2>/dev/null
mv CLUBOS_EXTERNAL_DEPLOYMENT_PACKAGE.md docs/deployment/ 2>/dev/null
mv hubspot-embed-instructions.md docs/deployment/ 2>/dev/null
mv DEVELOPMENT_GUIDE.md docs/development/ 2>/dev/null
mv TESTING_GUIDE.md docs/development/ 2>/dev/null

# Clean up .DS_Store files
find . -name ".DS_Store" -delete

# Update root README with current structure
cat > README_STRUCTURE.md << 'EOF'
# ClubOSV1 Directory Structure

```
CLUBOSV1/
├── ClubOSV1-backend/     # Express/TypeScript API server
├── ClubOSV1-frontend/    # Next.js/TypeScript UI
├── ClubOS Agents/        # LLM agent configurations
├── scripts/              # Utility scripts
├── docs/                 # All documentation
│   ├── setup/
│   ├── deployment/
│   └── development/
├── archive/              # Old/completed files
├── .env.production.example
├── CHANGELOG.md         # Version history
├── README.md            # Main documentation
└── deploy-facility.sh   # Production deployment
```

## Quick Commands

```bash
# Backend
cd ClubOSV1-backend && npm run dev

# Frontend  
cd ClubOSV1-frontend && npm run dev

# Deploy to production
./deploy-facility.sh

# Generate deployment package
./generate-deployment-package.sh
```

## Latest Version: 1.6.1 (2025-07-27)
- PostgreSQL integration complete
- Multi-agent LLM routing active
- Deployed on Railway + Vercel
EOF

echo "→ Creating clean package.json for root..."
cat > package.json << 'EOF'
{
  "name": "clubosv1",
  "version": "1.6.1",
  "private": true,
  "scripts": {
    "dev": "concurrently \"cd ClubOSV1-backend && npm run dev\" \"cd ClubOSV1-frontend && npm run dev\"",
    "install:all": "cd ClubOSV1-backend && npm install && cd ../ClubOSV1-frontend && npm install",
    "build:all": "cd ClubOSV1-backend && npm run build && cd ../ClubOSV1-frontend && npm run build",
    "deploy": "./deploy-facility.sh"
  },
  "devDependencies": {
    "concurrently": "^7.6.0"
  }
}
EOF

# List final structure
echo -e "\n✓ Cleanup complete. New structure:"
ls -la | grep -E "^d|^-" | grep -v "^\."

echo -e "\n✓ Archived files to: $ARCHIVE_DIR"
echo "✓ Root is now clean and organized"
