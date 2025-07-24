#!/bin/bash

echo "📦 Git Add & Commit Script for ClubOS Cleanup"
echo "============================================="
echo ""

cd "/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"

# Show current git status
echo "📊 Current git status:"
echo "---------------------"
git status --short

echo ""
echo "This will commit all cleanup changes including:"
echo "- Archived scripts moved to archive/"
echo "- Cleaned log files"
echo "- Removed .DS_Store files"
echo "- Organized documentation"
echo "- Updated .gitignore"
echo ""
read -p "Proceed with git add and commit? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Git commit cancelled."
    exit 1
fi

# Add all changes including deletions
echo ""
echo "➕ Adding all changes..."
git add -A

# Show what will be committed
echo ""
echo "📋 Files to be committed:"
echo "------------------------"
git status --short

# Create detailed commit message
echo ""
echo "💬 Creating commit..."

git commit -m "chore: major cleanup and organization of ClubOS project

- Organized root directory: moved 100+ scripts to archive/
  - archive/deployment-scripts/ - all deploy-*.sh files
  - archive/test-scripts/ - all test-*.sh files  
  - archive/fix-scripts/ - all fix/patch scripts
  - archive/docs/ - setup guides and documentation

- Cleaned up project files:
  - Removed all .DS_Store files
  - Cleared log files (5.3 MB freed)
  - Removed unused RoleSwitcher from dashboard
  - Organized backend documentation into docs/

- Updated .gitignore:
  - Added .DS_Store to prevent future commits
  - Ensure build artifacts stay ignored

- Improvements:
  - Root directory now clean and organized
  - Only essential files remain in root
  - All scripts preserved in archive for reference
  - Better project structure for maintenance

This cleanup improves project maintainability while preserving
all historical scripts in organized archive folders."

echo ""
echo "✅ Commit created!"
echo ""
echo "📤 Ready to push. Run:"
echo "   git push origin main"
echo ""
echo "💡 Optional: After verifying everything works, you can:"
echo "   rm -rf archive/  # Delete archived scripts"
echo "   git add -A && git commit -m 'chore: remove archived scripts'"