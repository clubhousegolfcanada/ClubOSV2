#!/bin/bash

# Complete UI Color Migration Script
# Replaces ALL hardcoded colors with CSS variables across the entire app
# Date: September 7, 2025

echo "================================"
echo "Complete Color Migration Script"
echo "================================"
echo ""
echo "This script will replace ALL hardcoded colors with CSS variables."
echo "Migrating pages, components, and configuration files."
echo ""

# Counter for tracking changes
TOTAL_CHANGES=0
FILES_CHANGED=0

# Function to process a file
process_file() {
    local file=$1
    local changes_before=0
    local changes_after=0
    
    # Count instances before
    changes_before=$(grep -c '#0B3D3A\|#0b3d3a\|#084a45\|#094A3F\|#094a3f' "$file" 2>/dev/null || echo 0)
    
    if [ $changes_before -eq 0 ]; then
        return
    fi
    
    echo "Processing: $file ($changes_before instances)"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Replace all color variations
    sed -i '' 's/bg-\[#0B3D3A\]/bg-[var(--accent)]/g' "$file"
    sed -i '' 's/bg-\[#0b3d3a\]/bg-[var(--accent)]/g' "$file"
    sed -i '' 's/hover:bg-\[#084a45\]/hover:bg-[var(--accent-hover)]/g' "$file"
    sed -i '' 's/hover:bg-\[#094A3F\]/hover:bg-[var(--accent-hover)]/g' "$file"
    sed -i '' 's/hover:bg-\[#094a3f\]/hover:bg-[var(--accent-hover)]/g' "$file"
    sed -i '' 's/text-\[#0B3D3A\]/text-[var(--accent)]/g' "$file"
    sed -i '' 's/text-\[#0b3d3a\]/text-[var(--accent)]/g' "$file"
    sed -i '' 's/text-\[#084a45\]/text-[var(--accent-hover)]/g' "$file"
    sed -i '' 's/border-\[#0B3D3A\]/border-[var(--accent)]/g' "$file"
    sed -i '' 's/border-\[#0b3d3a\]/border-[var(--accent)]/g' "$file"
    sed -i '' 's/border-l-\[#0B3D3A\]/border-l-[var(--accent)]/g' "$file"
    sed -i '' 's/ring-\[#0B3D3A\]/ring-[var(--accent)]/g' "$file"
    sed -i '' 's/ring-\[#0b3d3a\]/ring-[var(--accent)]/g' "$file"
    sed -i '' 's/focus:ring-\[#0B3D3A\]/focus:ring-[var(--accent)]/g' "$file"
    sed -i '' 's/divide-\[#0B3D3A\]/divide-[var(--accent)]/g' "$file"
    sed -i '' 's/from-\[#0B3D3A\]/from-[var(--accent)]/g' "$file"
    sed -i '' 's/to-\[#0B3D3A\]/to-[var(--accent)]/g' "$file"
    sed -i '' 's/to-\[#084a45\]/to-[var(--accent-hover)]/g' "$file"
    
    # Replace in gradients
    sed -i '' 's/from-\[#0B3D3A\]/from-[var(--accent)]/g' "$file"
    sed -i '' 's/to-\[#0B3D3A\]\/80/to-[var(--accent)]\/80/g' "$file"
    sed -i '' 's/from-\[#0B3D3A\]\/10/from-[var(--accent)]\/10/g' "$file"
    
    # Replace fill and stroke for SVGs
    sed -i '' 's/fill="#0B3D3A"/fill="var(--accent)"/g' "$file"
    sed -i '' 's/fill="#0b3d3a"/fill="var(--accent)"/g' "$file"
    sed -i '' 's/stroke="#0B3D3A"/stroke="var(--accent)"/g' "$file"
    sed -i '' 's/stroke="#0b3d3a"/stroke="var(--accent)"/g' "$file"
    
    # Replace in style objects
    sed -i '' "s/'#0B3D3A'/'var(--accent)'/g" "$file"
    sed -i '' "s/'#0b3d3a'/'var(--accent)'/g" "$file"
    sed -i '' "s/'#084a45'/'var(--accent-hover)'/g" "$file"
    
    # Replace raw hex in CSS/style blocks
    sed -i '' 's/#0B3D3A/var(--accent)/g' "$file"
    sed -i '' 's/#0b3d3a/var(--accent)/g' "$file"
    sed -i '' 's/#084a45/var(--accent-hover)/g' "$file"
    
    # Count instances after
    changes_after=$(grep -c '#0B3D3A\|#0b3d3a\|#084a45\|#094A3F\|#094a3f' "$file" 2>/dev/null || echo 0)
    
    # Calculate actual changes
    local actual_changes=$((changes_before - changes_after))
    
    if [ $actual_changes -gt 0 ]; then
        echo "  ✓ Updated $actual_changes instances"
        TOTAL_CHANGES=$((TOTAL_CHANGES + actual_changes))
        FILES_CHANGED=$((FILES_CHANGED + 1))
        rm "$file.backup"
    else
        echo "  ✓ No changes needed (may be in comments or special cases)"
        rm "$file.backup"
    fi
}

echo ""
echo "Starting complete migration..."
echo "==============================="
echo ""

# Process all TypeScript/React files
echo "Finding all files with hardcoded colors..."
FILES=$(find ClubOSV1-frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec grep -l '#0B3D3A\|#0b3d3a\|#084a45\|#094A3F\|#094a3f' {} \;)

FILE_COUNT=$(echo "$FILES" | wc -l)
echo "Found $FILE_COUNT files to process"
echo ""

# Process each file
for file in $FILES; do
    if [ -f "$file" ]; then
        process_file "$file"
    fi
done

echo ""
echo "================================"
echo "Migration Complete!"
echo "================================"
echo "Files changed: $FILES_CHANGED"
echo "Total color instances migrated: $TOTAL_CHANGES"
echo ""
echo "Next steps:"
echo "1. Test the application thoroughly"
echo "2. Verify colors still appear correctly"
echo "3. Check dark/light mode switching"
echo "4. Commit the changes"
echo ""
echo "To verify no hardcoded colors remain, run:"
echo "grep -r '#0B3D3A\\|#084a45' ClubOSV1-frontend/src --include='*.tsx' --include='*.ts'"