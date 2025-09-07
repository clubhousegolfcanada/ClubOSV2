#!/bin/bash

# UI Color Migration Script
# Replaces hardcoded colors with CSS variables for white-label support
# Date: September 7, 2025

echo "================================"
echo "ClubOS UI Color Migration Script"
echo "================================"
echo ""
echo "This script will replace hardcoded colors with CSS variables."
echo "Current brand color #0B3D3A will still be used via CSS variables."
echo ""

# Colors to replace
PRIMARY_COLOR="#0B3D3A"
PRIMARY_COLOR_LOWER="#0b3d3a"
HOVER_COLOR="#084a45"
HOVER_COLOR_ALT="#094A3F"
HOVER_COLOR_ALT_LOWER="#094a3f"

# Counter for tracking changes
TOTAL_CHANGES=0

# Function to process a file
process_file() {
    local file=$1
    local changes=0
    
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Replace bg-[#0B3D3A] with bg-[var(--accent)]
    sed -i '' 's/bg-\[#0B3D3A\]/bg-[var(--accent)]/g' "$file"
    changes=$((changes + $(grep -c "bg-\[var(--accent)\]" "$file" 2>/dev/null || echo 0)))
    
    # Replace bg-[#0b3d3a] with bg-[var(--accent)]
    sed -i '' 's/bg-\[#0b3d3a\]/bg-[var(--accent)]/g' "$file"
    
    # Replace hover:bg-[#084a45] with hover:bg-[var(--accent-hover)]
    sed -i '' 's/hover:bg-\[#084a45\]/hover:bg-[var(--accent-hover)]/g' "$file"
    sed -i '' 's/hover:bg-\[#094A3F\]/hover:bg-[var(--accent-hover)]/g' "$file"
    sed -i '' 's/hover:bg-\[#094a3f\]/hover:bg-[var(--accent-hover)]/g' "$file"
    
    # Replace text-[#0B3D3A] with text-[var(--accent)]
    sed -i '' 's/text-\[#0B3D3A\]/text-[var(--accent)]/g' "$file"
    sed -i '' 's/text-\[#0b3d3a\]/text-[var(--accent)]/g' "$file"
    
    # Replace border-[#0B3D3A] with border-[var(--accent)]
    sed -i '' 's/border-\[#0B3D3A\]/border-[var(--accent)]/g' "$file"
    sed -i '' 's/border-\[#0b3d3a\]/border-[var(--accent)]/g' "$file"
    
    # Replace ring-[#0B3D3A] with ring-[var(--accent)]
    sed -i '' 's/ring-\[#0B3D3A\]/ring-[var(--accent)]/g' "$file"
    sed -i '' 's/ring-\[#0b3d3a\]/ring-[var(--accent)]/g' "$file"
    
    # Replace divide-[#0B3D3A] with divide-[var(--accent)]
    sed -i '' 's/divide-\[#0B3D3A\]/divide-[var(--accent)]/g' "$file"
    
    # Replace fill="#0B3D3A" with fill="var(--accent)" for SVGs
    sed -i '' 's/fill="#0B3D3A"/fill="var(--accent)"/g' "$file"
    sed -i '' 's/fill="#0b3d3a"/fill="var(--accent)"/g' "$file"
    
    # Replace stroke="#0B3D3A" with stroke="var(--accent)" for SVGs
    sed -i '' 's/stroke="#0B3D3A"/stroke="var(--accent)"/g' "$file"
    sed -i '' 's/stroke="#0b3d3a"/stroke="var(--accent)"/g' "$file"
    
    # Replace color: '#0B3D3A' in style objects
    sed -i '' "s/color: '#0B3D3A'/color: 'var(--accent)'/g" "$file"
    sed -i '' "s/backgroundColor: '#0B3D3A'/backgroundColor: 'var(--accent)'/g" "$file"
    sed -i '' "s/borderColor: '#0B3D3A'/borderColor: 'var(--accent)'/g" "$file"
    
    # Count actual changes by comparing with backup
    if diff -q "$file" "$file.backup" > /dev/null; then
        echo "  ✓ No changes needed"
        rm "$file.backup"
    else
        changes=$(diff "$file" "$file.backup" | grep "^<" | wc -l)
        echo "  ✓ Updated $changes instances"
        TOTAL_CHANGES=$((TOTAL_CHANGES + changes))
        
        # Remove backup after successful migration
        rm "$file.backup"
    fi
}

# Process customer pages
echo ""
echo "Starting migration..."
echo "--------------------"

# Customer pages to process
CUSTOMER_PAGES=(
    "ClubOSV1-frontend/src/pages/customer/compete.tsx"
    "ClubOSV1-frontend/src/pages/customer/profile.tsx"
    "ClubOSV1-frontend/src/pages/customer/index.tsx"
    "ClubOSV1-frontend/src/pages/customer/bookings.tsx"
    "ClubOSV1-frontend/src/pages/customer/events.tsx"
    "ClubOSV1-frontend/src/pages/customer/leaderboard.tsx"
    "ClubOSV1-frontend/src/pages/customer/settings.tsx"
    "ClubOSV1-frontend/src/pages/customer/challenges/index.tsx"
    "ClubOSV1-frontend/src/pages/customer/challenges/create.tsx"
    "ClubOSV1-frontend/src/pages/customer/challenges/[id].tsx"
)

# Process each file
for file in "${CUSTOMER_PAGES[@]}"; do
    if [ -f "$file" ]; then
        process_file "$file"
    else
        echo "Warning: File not found - $file"
    fi
done

# Process components
echo ""
echo "Processing components..."
COMPONENTS=(
    "ClubOSV1-frontend/src/components/CustomerNavigation.tsx"
    "ClubOSV1-frontend/src/components/QuickBookCard.tsx"
    "ClubOSV1-frontend/src/components/CustomerDashboard.tsx"
)

for file in "${COMPONENTS[@]}"; do
    if [ -f "$file" ]; then
        process_file "$file"
    fi
done

echo ""
echo "================================"
echo "Migration Complete!"
echo "Total changes made: $TOTAL_CHANGES"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to test the changes"
echo "2. Verify colors still appear correctly"
echo "3. Check dark/light mode switching"
echo "4. Update the UI-STANDARDIZATION-TRACKER.md"
echo ""
echo "To verify remaining hardcoded colors, run:"
echo "grep -r '#0B3D3A\\|#084a45' ClubOSV1-frontend/src/pages/customer"