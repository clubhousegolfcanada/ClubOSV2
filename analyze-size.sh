#!/bin/bash

# ClubOS Cleanup Script - Analyze and clean up large files/directories

echo "🧹 ClubOS Cleanup Analysis"
echo "=========================="

CLUBOS_ROOT="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

echo -e "\n📊 Analyzing directory sizes..."

# Function to convert bytes to human readable
human_readable() {
    local bytes=$1
    if [ $bytes -gt 1073741824 ]; then
        echo "$(( bytes / 1073741824 ))GB"
    elif [ $bytes -gt 1048576 ]; then
        echo "$(( bytes / 1048576 ))MB"
    else
        echo "$(( bytes / 1024 ))KB"
    fi
}

# Check total size
echo -e "\n📁 Total ClubOS size:"
du -sh "$CLUBOS_ROOT" 2>/dev/null || echo "Cannot calculate total size"

echo -e "\n📦 Checking common large directories..."

# Backend checks
echo -e "\n🔵 Backend Analysis:"
if [ -d "$CLUBOS_ROOT/ClubOSV1-backend" ]; then
    echo "  node_modules: $(du -sh "$CLUBOS_ROOT/ClubOSV1-backend/node_modules" 2>/dev/null | cut -f1 || echo "Not found")"
    echo "  dist (build): $(du -sh "$CLUBOS_ROOT/ClubOSV1-backend/dist" 2>/dev/null | cut -f1 || echo "Not found")"
    echo "  logs: $(du -sh "$CLUBOS_ROOT/ClubOSV1-backend/logs" 2>/dev/null | cut -f1 || echo "Not found")"
    echo "  .git: $(du -sh "$CLUBOS_ROOT/ClubOSV1-backend/.git" 2>/dev/null | cut -f1 || echo "Not found")"
fi

# Frontend checks
echo -e "\n🟢 Frontend Analysis:"
if [ -d "$CLUBOS_ROOT/ClubOSV1-frontend" ]; then
    echo "  node_modules: $(du -sh "$CLUBOS_ROOT/ClubOSV1-frontend/node_modules" 2>/dev/null | cut -f1 || echo "Not found")"
    echo "  .next (build): $(du -sh "$CLUBOS_ROOT/ClubOSV1-frontend/.next" 2>/dev/null | cut -f1 || echo "Not found")"
    echo "  .git: $(du -sh "$CLUBOS_ROOT/ClubOSV1-frontend/.git" 2>/dev/null | cut -f1 || echo "Not found")"
fi

# Find large files
echo -e "\n📄 Large files (>50MB):"
find "$CLUBOS_ROOT" -type f -size +50M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' | head -10

# Check for common cleanup candidates
echo -e "\n🗑️  Potential cleanup targets:"
echo "  - node_modules directories (can be reinstalled with npm install)"
echo "  - .next directory (Next.js build cache)"
echo "  - dist directories (compiled output)"
echo "  - log files"
echo "  - .DS_Store files (macOS metadata)"
echo "  - npm cache"

# Calculate potential savings
POTENTIAL_SAVINGS=0
if [ -d "$CLUBOS_ROOT/ClubOSV1-backend/node_modules" ]; then
    BACKEND_NODE=$(du -sb "$CLUBOS_ROOT/ClubOSV1-backend/node_modules" 2>/dev/null | cut -f1 || echo 0)
    POTENTIAL_SAVINGS=$((POTENTIAL_SAVINGS + BACKEND_NODE))
fi
if [ -d "$CLUBOS_ROOT/ClubOSV1-frontend/node_modules" ]; then
    FRONTEND_NODE=$(du -sb "$CLUBOS_ROOT/ClubOSV1-frontend/node_modules" 2>/dev/null | cut -f1 || echo 0)
    POTENTIAL_SAVINGS=$((POTENTIAL_SAVINGS + FRONTEND_NODE))
fi
if [ -d "$CLUBOS_ROOT/ClubOSV1-frontend/.next" ]; then
    NEXT_BUILD=$(du -sb "$CLUBOS_ROOT/ClubOSV1-frontend/.next" 2>/dev/null | cut -f1 || echo 0)
    POTENTIAL_SAVINGS=$((POTENTIAL_SAVINGS + NEXT_BUILD))
fi

echo -e "\n💾 Potential space savings: $(human_readable $POTENTIAL_SAVINGS)"

echo -e "\n🤔 Would you like to create a cleanup script? (This will create cleanup.sh)"
