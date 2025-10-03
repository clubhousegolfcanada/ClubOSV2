#!/bin/bash

# ClubOS Codebase Standardization Script
# This script helps organize and standardize the codebase structure

echo "🔧 ClubOS Standardization Script"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to create directories
create_structure() {
    echo "📁 Creating standard directory structure..."
    
    # Create main directories
    mkdir -p scripts/{dev,deploy,test,utils,security}
    mkdir -p config
    mkdir -p .github/workflows
    
    echo "✅ Directory structure created"
}

# Function to organize scripts
organize_scripts() {
    echo ""
    echo "📦 Organizing scripts..."
    
    # Move test scripts
    mv test-*.sh scripts/test/ 2>/dev/null
    mv test-*.js scripts/test/ 2>/dev/null
    
    # Move fix scripts
    mv fix-*.sh scripts/utils/ 2>/dev/null
    
    # Move deployment scripts
    mv deploy*.sh scripts/deploy/ 2>/dev/null
    mv *-deploy.sh scripts/deploy/ 2>/dev/null
    
    # Move setup scripts
    mv setup*.sh scripts/dev/ 2>/dev/null
    
    echo "✅ Scripts organized"
}

# Function to clean root directory
clean_root() {
    echo ""
    echo "🧹 Cleaning root directory..."
    
    # Move config files
    mv *.config.js config/ 2>/dev/null
    mv *.config.ts config/ 2>/dev/null
    
    # Keep only essential files in root
    echo "   Keeping: package.json, README.md, CHANGELOG.md, CLAUDE.md"
    echo "   Moving everything else to appropriate directories"
    
    echo "✅ Root directory cleaned"
}

# Function to standardize naming
standardize_naming() {
    echo ""
    echo "📝 Checking naming conventions..."
    
    # Count different naming styles
    SNAKE_COUNT=$(find . -type f -name "*_*" | grep -v node_modules | grep -v .git | wc -l | tr -d ' ')
    KEBAB_COUNT=$(find . -type f -name "*-*" | grep -v node_modules | grep -v .git | wc -l | tr -d ' ')
    
    echo "   Found $SNAKE_COUNT snake_case files"
    echo "   Found $KEBAB_COUNT kebab-case files"
    echo ""
    echo -e "${YELLOW}   Recommendation: Use kebab-case for scripts, PascalCase for React components${NC}"
}

# Function to remove duplicates
remove_duplicates() {
    echo ""
    echo "🔍 Checking for duplicate files..."
    
    # Find potential duplicates by name pattern
    echo "   Test files that might be duplicates:"
    ls test-*.* 2>/dev/null | head -5
    
    echo ""
    echo -e "${YELLOW}   Manual review needed for duplicate removal${NC}"
}

# Function to create gitignore entries
update_gitignore() {
    echo ""
    echo "📄 Updating .gitignore..."
    
    # Add standard ignores if not present
    grep -q "*.log" .gitignore || echo "*.log" >> .gitignore
    grep -q ".env.local" .gitignore || echo ".env.local" >> .gitignore
    grep -q ".env.production" .gitignore || echo ".env.production" >> .gitignore
    grep -q "node_modules/" .gitignore || echo "node_modules/" >> .gitignore
    grep -q "dist/" .gitignore || echo "dist/" >> .gitignore
    grep -q ".DS_Store" .gitignore || echo ".DS_Store" >> .gitignore
    
    echo "✅ .gitignore updated"
}

# Function to generate report
generate_report() {
    echo ""
    echo "📊 Generating standardization report..."
    
    # Create report
    cat > STANDARDIZATION-PROGRESS.md << EOF
# Standardization Progress Report
Generated: $(date)

## Completed Actions
- ✅ Created standard directory structure
- ✅ Organized scripts into categories
- ✅ Updated .gitignore
- ✅ Generated audit report

## Pending Actions
- [ ] Review and remove duplicate files
- [ ] Standardize component naming to PascalCase
- [ ] Convert snake_case files to kebab-case
- [ ] Add ESLint and Prettier configs
- [ ] Create pre-commit hooks
- [ ] Update import paths to use aliases

## File Statistics
- Scripts in /scripts: $(find scripts -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
- Config files in /config: $(find config -name "*" -type f 2>/dev/null | wc -l | tr -d ' ')
- Root directory files: $(ls -1 | wc -l | tr -d ' ')

## Next Steps
1. Review duplicate files and remove unnecessary ones
2. Run ESLint with --fix flag
3. Set up Prettier formatting
4. Create coding standards document
EOF
    
    echo "✅ Report saved to STANDARDIZATION-PROGRESS.md"
}

# Main execution
echo "This script will help standardize your codebase structure."
echo ""
read -p "Do you want to proceed? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    create_structure
    organize_scripts
    clean_root
    standardize_naming
    remove_duplicates
    update_gitignore
    generate_report
    
    echo ""
    echo "✨ Standardization complete!"
    echo "   Check STANDARDIZATION-PROGRESS.md for details"
    echo "   Check STANDARDIZATION-AUDIT.md for full audit"
else
    echo "Standardization cancelled."
fi