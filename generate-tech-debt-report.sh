#!/bin/bash

# Tech Debt Analysis Script for ClubOS
# Generates comprehensive technical debt report

echo "🔍 ClubOS Technical Debt Analysis"
echo "================================="
echo "Generated: $(date)"
echo ""

PROJECT_ROOT="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"
cd "$PROJECT_ROOT"

# Create report directory
mkdir -p tech-debt-reports
REPORT_FILE="tech-debt-reports/tech-debt-$(date +%Y%m%d-%H%M%S).md"

# Start report
cat > "$REPORT_FILE" << 'EOF'
# ClubOS Technical Debt Report

## Script Analysis

### Total Scripts Found
EOF

# Count scripts
echo "- Shell scripts: $(find . -name "*.sh" | grep -v node_modules | wc -l)" >> "$REPORT_FILE"
echo "- Fix scripts: $(find . -name "fix-*.sh" | grep -v node_modules | wc -l)" >> "$REPORT_FILE"
echo "- Deploy scripts: $(find . -name "deploy-*.sh" | grep -v node_modules | wc -l)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# List all scripts
echo "### Script Inventory" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
find . -name "*.sh" -type f | grep -v node_modules | sort >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# TypeScript issues
echo "## TypeScript Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Count any types
echo "### Usage of 'any' type" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
grep -r "any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=dist | wc -l >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Security analysis
echo "## Security Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Disabled Security Features" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
grep -r "authenticate.*\/\/" --include="*.ts" --exclude-dir=node_modules || echo "None found" >> "$REPORT_FILE"
grep -r "rateLimiter.*\/\/" --include="*.ts" --exclude-dir=node_modules || echo "None found" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Database analysis
echo "## Database Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### JSON Files Still Present" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
find . -name "*.json" -path "*/data/*" | grep -v node_modules | sort >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# TODO/FIXME analysis
echo "## TODO/FIXME Comments" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Count by Type" >> "$REPORT_FILE"
echo "- TODO: $(grep -r "TODO" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)" >> "$REPORT_FILE"
echo "- FIXME: $(grep -r "FIXME" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)" >> "$REPORT_FILE"
echo "- HACK: $(grep -r "HACK" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)" >> "$REPORT_FILE"
echo "- XXX: $(grep -r "XXX" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Error handling analysis
echo "## Error Handling Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Console.log Usage (Should use logger)" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Duplicate code analysis
echo "## Code Duplication Indicators" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Files with Similar Names" >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs -I {} basename {} | sort | uniq -d >> "$REPORT_FILE"
echo '```' >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Dependencies analysis
echo "## Dependencies Analysis" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Backend Dependencies" >> "$REPORT_FILE"
echo "- Total: $(cd ClubOSV1-backend && npm list --depth=0 2>/dev/null | grep -c "├──")" >> "$REPORT_FILE"
echo "- Outdated: $(cd ClubOSV1-backend && npm outdated --depth=0 2>/dev/null | grep -c "^")" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Frontend Dependencies" >> "$REPORT_FILE"
echo "- Total: $(cd ClubOSV1-frontend && npm list --depth=0 2>/dev/null | grep -c "├──")" >> "$REPORT_FILE"
echo "- Outdated: $(cd ClubOSV1-frontend && npm outdated --depth=0 2>/dev/null | grep -c "^")" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Summary
echo "## Summary Statistics" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### File Counts" >> "$REPORT_FILE"
echo "- TypeScript files: $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l)" >> "$REPORT_FILE"
echo "- JavaScript files: $(find . -name "*.js" | grep -v node_modules | grep -v dist | wc -l)" >> "$REPORT_FILE"
echo "- Shell scripts: $(find . -name "*.sh" | grep -v node_modules | wc -l)" >> "$REPORT_FILE"
echo "- SQL files: $(find . -name "*.sql" | grep -v node_modules | wc -l)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Lines of Code (excluding node_modules)" >> "$REPORT_FILE"
echo "- TypeScript: $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs wc -l | tail -1 | awk '{print $1}')" >> "$REPORT_FILE"
echo "- Total: $(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | grep -v node_modules | xargs wc -l | tail -1 | awk '{print $1}')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Generate actionable items
echo "## Actionable Items" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### Critical (Fix Immediately)" >> "$REPORT_FILE"
echo "1. Enable authentication on LLM endpoints" >> "$REPORT_FILE"
echo "2. Fix DATABASE_URL validation" >> "$REPORT_FILE"
echo "3. Re-enable rate limiting" >> "$REPORT_FILE"
echo "4. Fix createAdmin.ts script" >> "$REPORT_FILE"
echo "5. Complete Slack reply UI integration" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "### High Priority (Fix This Week)" >> "$REPORT_FILE"
echo "1. Consolidate $(find . -name "*.sh" | grep -v node_modules | wc -l) shell scripts" >> "$REPORT_FILE"
echo "2. Remove $(find . -name "*.json" -path "*/data/*" | grep -v node_modules | wc -l) JSON data files" >> "$REPORT_FILE"
echo "3. Fix $(grep -r "any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l) TypeScript 'any' usages" >> "$REPORT_FILE"
echo "4. Replace $(grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l) console.log with logger" >> "$REPORT_FILE"
echo "5. Address $(grep -r "TODO\|FIXME" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l) TODO/FIXME comments" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Output location
echo ""
echo "✅ Tech debt report generated: $REPORT_FILE"
echo ""
echo "Summary:"
echo "- Scripts found: $(find . -name "*.sh" | grep -v node_modules | wc -l)"
echo "- TypeScript files: $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l)"
echo "- 'any' type usage: $(grep -r "any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)"
echo "- TODO comments: $(grep -r "TODO" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules | wc -l)"
echo ""
echo "View the full report: cat $REPORT_FILE"
