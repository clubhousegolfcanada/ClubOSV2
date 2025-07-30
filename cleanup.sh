#!/bin/bash

# ClubOS Cleanup Script - Remove unnecessary files to save space

echo "🧹 ClubOS Cleanup Script"
echo "======================="
echo "⚠️  This will remove build artifacts and dependencies that can be reinstalled"
echo ""

CLUBOS_ROOT="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Function to show size before cleanup
show_size() {
    echo "Current total size: $(du -sh "$CLUBOS_ROOT" 2>/dev/null | cut -f1)"
}

echo "📊 Size before cleanup:"
show_size

echo -e "\n🗑️  Starting cleanup..."

# 1. Remove node_modules (can be reinstalled with npm install)
echo -e "\n1️⃣ Removing node_modules directories..."
if [ -d "$CLUBOS_ROOT/ClubOSV1-backend/node_modules" ]; then
    echo "   Removing backend node_modules..."
    rm -rf "$CLUBOS_ROOT/ClubOSV1-backend/node_modules"
    echo "   ✅ Backend node_modules removed"
fi

if [ -d "$CLUBOS_ROOT/ClubOSV1-frontend/node_modules" ]; then
    echo "   Removing frontend node_modules..."
    rm -rf "$CLUBOS_ROOT/ClubOSV1-frontend/node_modules"
    echo "   ✅ Frontend node_modules removed"
fi

# 2. Remove Next.js build cache
echo -e "\n2️⃣ Removing Next.js build cache..."
if [ -d "$CLUBOS_ROOT/ClubOSV1-frontend/.next" ]; then
    rm -rf "$CLUBOS_ROOT/ClubOSV1-frontend/.next"
    echo "   ✅ .next directory removed"
fi

# 3. Remove TypeScript build output
echo -e "\n3️⃣ Removing TypeScript build output..."
if [ -d "$CLUBOS_ROOT/ClubOSV1-backend/dist" ]; then
    rm -rf "$CLUBOS_ROOT/ClubOSV1-backend/dist"
    echo "   ✅ Backend dist directory removed"
fi

# 4. Remove log files
echo -e "\n4️⃣ Cleaning up log files..."
find "$CLUBOS_ROOT" -name "*.log" -type f -delete 2>/dev/null
find "$CLUBOS_ROOT" -name "npm-debug.log*" -type f -delete 2>/dev/null
echo "   ✅ Log files removed"

# 5. Remove .DS_Store files (macOS)
echo -e "\n5️⃣ Removing .DS_Store files..."
find "$CLUBOS_ROOT" -name ".DS_Store" -type f -delete 2>/dev/null
echo "   ✅ .DS_Store files removed"

# 6. Clear npm cache
echo -e "\n6️⃣ Clearing npm cache..."
npm cache clean --force 2>/dev/null
echo "   ✅ npm cache cleared"

# 7. Remove any .cache directories
echo -e "\n7️⃣ Removing cache directories..."
find "$CLUBOS_ROOT" -name ".cache" -type d -exec rm -rf {} + 2>/dev/null
echo "   ✅ Cache directories removed"

echo -e "\n✅ Cleanup complete!"
echo -e "\n📊 Size after cleanup:"
show_size

echo -e "\n📝 To restore functionality:"
echo "1. Backend: cd ClubOSV1-backend && npm install"
echo "2. Frontend: cd ClubOSV1-frontend && npm install"
echo ""
echo "💡 Tip: You can also create a .gitignore to prevent committing these large directories"
