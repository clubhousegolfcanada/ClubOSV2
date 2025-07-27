#!/bin/bash

# ClubOS V1 - Cleanup Script to Reduce Project Size
# This script removes unnecessary files to reduce the 1.4GB bloat

echo "🧹 ClubOS Cleanup Script - Reducing project size..."
echo "Current size: $(du -sh /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1 | cut -f1)"

# Navigate to project root
cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1

echo -e "\n📦 Removing node_modules (will need npm install to restore)..."
# Remove all node_modules folders
find . -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null

echo -e "\n🗂️ Cleaning build artifacts..."
# Remove dist/build folders
rm -rf ClubOSV1-backend/dist
rm -rf ClubOSV1-frontend/.next
rm -rf ClubOSV1-frontend/out

echo -e "\n📝 Cleaning logs (keeping structure)..."
# Clean log files but keep the folders
> ClubOSV1-backend/logs/combined.log
> ClubOSV1-backend/logs/error.log
> ClubOSV1-backend/server.log

echo -e "\n🗑️ Removing .DS_Store files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null

echo -e "\n🖼️ Removing Icon files..."
find . -name "Icon" -type f -delete 2>/dev/null

echo -e "\n📊 Cleaning data backups..."
# Remove backup files
find . -name "*.backup" -type f -delete 2>/dev/null
find . -name "*.bak" -type f -delete 2>/dev/null

echo -e "\n✅ Cleanup complete!"
echo "New size: $(du -sh /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1 | cut -f1)"

echo -e "\n📋 To restore functionality:"
echo "1. cd ClubOSV1-backend && npm install"
echo "2. cd ClubOSV1-frontend && npm install"
echo "3. npm run build (when needed)"