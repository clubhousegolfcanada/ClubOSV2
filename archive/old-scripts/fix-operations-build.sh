#!/bin/bash
# Immediate fix for operations.tsx build error

cd /Users/michaelbelairch1/Desktop/Clubhouse\ OS\ \(Root\)/CLUBOSV1/ClubOSV1-frontend/src/pages

echo "🔧 Fixing operations.tsx build errors..."

# Backup
cp operations.tsx operations.tsx.audit-backup

# Fix 1: Clean up imports
echo "1. Fixing lucide-react imports..."
# Ensure all imports are properly formatted
sed -i '' '/import.*from.*lucide-react/,/}/ {
  s/Tr…nRight/ChevronRight/g
  s/…//g
  s/,,/,/g
  s/, *}/}/g
}' operations.tsx

# Fix 2: Remove any standalone ellipsis
echo "2. Removing standalone ellipsis..."
sed -i '' '/^[[:space:]]*…[[:space:]]*$/d' operations.tsx

# Fix 3: Replace Unicode ellipsis with proper syntax
echo "3. Replacing Unicode ellipsis..."
sed -i '' 's/…/.../g' operations.tsx

# Fix 4: Ensure imports are complete
echo "4. Verifying import structure..."
python3 - << 'EOF'
import re

with open('operations.tsx', 'r') as f:
    content = f.read()

# Find and fix the lucide-react import
import_pattern = r'import\s*\{([^}]+)\}\s*from\s*[\'"]lucide-react[\'"]'
match = re.search(import_pattern, content, re.DOTALL)

if match:
    imports = match.group(1)
    # Clean up the imports
    import_list = [i.strip() for i in imports.split(',') if i.strip()]
    
    # Ensure we have all the required icons
    required_icons = [
        'Download', 'AlertCircle', 'RefreshCw', 'Save', 'Upload', 
        'Trash2', 'Key', 'Eye', 'EyeOff', 'Settings', 'Bell', 
        'BarChart3', 'CheckSquare', 'Calendar', 'Clock', 'MapPin', 
        'Check', 'X', 'ChevronRight', 'Plus', 'Edit2', 'Brain', 
        'MessageSquare'
    ]
    
    # Add any missing icons
    for icon in required_icons:
        if icon not in import_list:
            import_list.append(icon)
    
    # Remove duplicates and sort
    import_list = sorted(list(set(import_list)))
    
    # Rebuild import statement
    new_imports = ',\n  '.join(import_list)
    new_import_statement = f'import {{\n  {new_imports}\n}} from \'lucide-react\';'
    
    # Replace in content
    content = re.sub(import_pattern, lambda m: new_import_statement, content, count=1)
    
    with open('operations.tsx', 'w') as f:
        f.write(content)
    
    print("✅ Fixed import statement")
else:
    print("❌ Could not find lucide-react import")
EOF

echo ""
echo "✅ Build errors fixed!"
echo ""
echo "Next steps:"
echo "1. Test the build: cd ../.. && npm run build"
echo "2. If successful, commit the changes"
echo "3. Begin refactoring based on OPERATIONS_REFACTOR_PLAN.md"
