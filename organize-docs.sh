#!/bin/bash

# Organize .md files into proper directory structure
echo "🗂️  Organizing documentation files..."

# Create directories if they don't exist
mkdir -p docs/{architecture,guides,deployment,development,planning,archive,implementation,features}

# Move implementation plans
mv -f *IMPLEMENTATION*.md docs/implementation/ 2>/dev/null
mv -f *PLAN*.md docs/planning/ 2>/dev/null

# Move deployment/infrastructure docs
mv -f *RAILWAY*.md docs/deployment/ 2>/dev/null
mv -f *REDIS*.md docs/deployment/ 2>/dev/null
mv -f *DEPLOY*.md docs/deployment/ 2>/dev/null
mv -f *UNIFI*.md docs/deployment/ 2>/dev/null

# Move feature documentation
mv -f *AUTOMATION*.md docs/features/ 2>/dev/null
mv -f *CHALLENGE*.md docs/features/ 2>/dev/null
mv -f *GIFT*.md docs/features/ 2>/dev/null
mv -f *CHATGPT*.md docs/features/ 2>/dev/null
mv -f *KNOWLEDGE*.md docs/features/ 2>/dev/null

# Move development docs
mv -f *FIX*.md docs/development/ 2>/dev/null
mv -f *DEBUG*.md docs/development/ 2>/dev/null
mv -f *TEST*.md docs/development/ 2>/dev/null
mv -f *REFACTOR*.md docs/development/ 2>/dev/null

# Move architecture docs
mv -f *AUDIT*.md docs/architecture/ 2>/dev/null
mv -f *SECURITY*.md docs/architecture/ 2>/dev/null
mv -f *ASSESSMENT*.md docs/architecture/ 2>/dev/null
mv -f *FLOW*.md docs/architecture/ 2>/dev/null

# Move old/completed docs to archive
mv -f *COMPLETE*.md docs/archive/ 2>/dev/null
mv -f *OLD*.md docs/archive/ 2>/dev/null
mv -f *DEPRECATED*.md docs/archive/ 2>/dev/null

# Keep essential files in root
echo "✅ Keeping essential files in root:"
echo "   - README.md"
echo "   - CHANGELOG.md"
echo "   - CLAUDE.md"
echo "   - LICENSE.md (if exists)"
echo "   - SECURITY.md (if exists)"

# Count files
echo ""
echo "📊 Documentation organized:"
echo "   - Implementation: $(ls docs/implementation/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Planning: $(ls docs/planning/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Deployment: $(ls docs/deployment/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Features: $(ls docs/features/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Development: $(ls docs/development/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Architecture: $(ls docs/architecture/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Archive: $(ls docs/archive/*.md 2>/dev/null | wc -l | tr -d ' ') files"
echo "   - Root (essential): $(ls *.md 2>/dev/null | wc -l | tr -d ' ') files"

echo ""
echo "✨ Documentation organized! Check docs/ directory for categorized files."