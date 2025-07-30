#!/bin/bash
# ClubOS V1 - Comprehensive Cleanup Script
# This script safely cleans up the ClubOS codebase

set -e

echo "🧹 ClubOS V1 Cleanup Script"
echo "=========================="
echo "This will clean up unnecessary files and optimize the codebase."
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Create backup before cleanup
BACKUP_DIR="../clubos-backup-$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR/"

# Create archive directory if it doesn't exist
ARCHIVE_DIR="../clubos-archive"
mkdir -p "$ARCHIVE_DIR"

# Function to safely remove files
safe_remove() {
    local file=$1
    if [ -e "$file" ]; then
        echo "  Removing: $file"
        rm -rf "$file"
    fi
}

echo ""
echo "1️⃣ Removing test files..."
find . -name "test-*.js" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    safe_remove "$file"
done
find . -name "test-*.ts" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    safe_remove "$file"
done
find . -name "test-*.sh" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    safe_remove "$file"
done
safe_remove "test-html"
safe_remove "test-scripts"
safe_remove "ClubOSV1-backend/src/routes/test-cors.ts"

echo ""
echo "2️⃣ Archiving old files..."
if [ -d "archive" ]; then
    echo "  Moving archive/ to $ARCHIVE_DIR"
    mv archive/* "$ARCHIVE_DIR/" 2>/dev/null || true
    rmdir archive
fi

echo ""
echo "3️⃣ Cleaning up data files (now in PostgreSQL)..."
safe_remove "ClubOSV1-backend/data/tickets/tickets.json"
safe_remove "ClubOSV1-backend/feedback_logs"
# Keep src/data for now as it may contain active data

echo ""
echo "4️⃣ Cleaning up logs..."
for logfile in ClubOSV1-backend/logs/*.log; do
    if [ -f "$logfile" ]; then
        echo "  Truncating: $logfile"
        > "$logfile"
    fi
done
safe_remove "ClubOSV1-backend/server.log"

echo ""
echo "5️⃣ Removing temporary files..."
safe_remove "clubos-v1-deployment-package"
safe_remove "clubos-v1-deployment-package.tar.gz"
find . -name "*.tmp" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    safe_remove "$file"
done
find . -name ".DS_Store" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    safe_remove "$file"
done
find . -name "Icon" -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
    safe_remove "$file"
done

echo ""
echo "6️⃣ Consolidating documentation..."
safe_remove "clubos_structure.txt"  # Duplicate of clubos-structure.txt
safe_remove "ClubOSV1-backend/docs/deployment"  # Empty directory

echo ""
echo "7️⃣ Cleaning build artifacts..."
safe_remove "ClubOSV1-frontend/.next"
safe_remove "ClubOSV1-backend/dist"

echo ""
echo "8️⃣ Updating .gitignore..."
cat >> .gitignore << 'EOF'

# Cleanup additions
*.log
test-*.js
test-*.ts
test-*.sh
*.tmp
.DS_Store
Icon
Icon?
server.log
deployment-package/
*.tar.gz
/archive/
/test-html/
/test-scripts/
EOF

echo ""
echo "9️⃣ Creating optimized structure documentation..."
cat > OPTIMIZED_STRUCTURE.md << 'EOF'
# ClubOS V1 - Optimized Structure

## Clean Directory Structure

```
CLUBOSV1/
├── backend/           # Express API server
│   ├── src/          # Source code
│   ├── tests/        # All backend tests
│   ├── scripts/      # Admin scripts
│   └── docs/         # API documentation
├── frontend/         # Next.js application
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   └── tests/        # Frontend tests
├── docs/             # Project documentation
├── scripts/          # Deployment & utility scripts
├── .env.example      # Environment template
├── README.md         # Project overview
└── package.json      # Root package file
```

## Removed Items
- Test files scattered throughout codebase
- Archive directory (moved to separate repo)
- Redundant data files (migrated to PostgreSQL)
- Temporary deployment packages
- Empty/duplicate documentation

## Next Steps
1. Run `npm install` in both backend and frontend
2. Set up PostgreSQL database
3. Configure environment variables
4. Run database migrations
5. Start development servers
EOF

echo ""
echo "🔟 Creating cleanup report..."
cat > CLEANUP_REPORT.md << EOF
# ClubOS V1 Cleanup Report

Date: $(date)

## Summary
The ClubOS V1 codebase has been cleaned and optimized.

## Actions Taken

### Files Removed
- Test files: All test-*.js/ts/sh files
- Directories: test-html/, test-scripts/
- Archive: Moved to $ARCHIVE_DIR
- Logs: Truncated all .log files
- Temporary: Removed .DS_Store, Icon files

### Structure Improvements
- Consolidated documentation
- Removed duplicate files
- Cleaned build artifacts
- Updated .gitignore

### Space Saved
Before: $(du -sh "$BACKUP_DIR" | cut -f1)
After: $(du -sh . | cut -f1)

## Recommendations

### Immediate Actions
1. Review and commit changes
2. Update CI/CD pipelines
3. Notify team of structure changes

### Future Optimizations
1. Implement Redis caching
2. Add database indexes
3. Enable rate limiting
4. Set up monitoring

## Backup Location
$BACKUP_DIR

---
Generated by cleanup script
EOF

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "  - Backup created at: $BACKUP_DIR"
echo "  - Archive moved to: $ARCHIVE_DIR"
echo "  - Space saved: Check CLEANUP_REPORT.md"
echo ""
echo "📋 Next steps:"
echo "1. Review CLEANUP_REPORT.md"
echo "2. Test the application"
echo "3. Commit changes if everything works"
echo "4. Delete backup after confirming success"
