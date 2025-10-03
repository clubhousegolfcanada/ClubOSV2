#!/bin/bash

# ClubOS Technical Audit Script
# Run from CLUBOSV1 directory

echo "==================================="
echo "ClubOS Technical Audit"
echo "Date: $(date)"
echo "==================================="

echo ""
echo "## Code Statistics"
echo "---------------------------------"

echo "### Backend Analysis"
echo "Total TypeScript files: $(find ClubOSV1-backend/src -name "*.ts" | wc -l)"
echo "Total Routes: $(ls ClubOSV1-backend/src/routes/*.ts 2>/dev/null | wc -l)"
echo "Total Services: $(ls ClubOSV1-backend/src/services/*.ts 2>/dev/null | wc -l)"
echo "Total Migrations: $(ls ClubOSV1-backend/src/database/migrations/*.sql 2>/dev/null | wc -l)"

echo ""
echo "### Frontend Analysis"
echo "Total Components: $(find ClubOSV1-frontend/src/components -name "*.tsx" 2>/dev/null | wc -l)"
echo "Total Pages: $(find ClubOSV1-frontend/src/pages -name "*.tsx" 2>/dev/null | wc -l)"

echo ""
echo "## Duplication Analysis"
echo "---------------------------------"

echo "### Duplicate Migration Numbers"
for num in 201 202 208 209 210; do
    count=$(ls ClubOSV1-backend/src/database/migrations/${num}_*.sql 2>/dev/null | wc -l)
    if [ $count -gt 1 ]; then
        echo "WARNING: Migration ${num} has ${count} files:"
        ls ClubOSV1-backend/src/database/migrations/${num}_*.sql
    fi
done

echo ""
echo "### Duplicate Route Implementations"
echo "Auth routes: $(ls ClubOSV1-backend/src/routes/auth*.ts 2>/dev/null | wc -l)"
echo "Knowledge routes: $(ls ClubOSV1-backend/src/routes/knowledge*.ts 2>/dev/null | wc -l)"
echo "OpenPhone routes: $(ls ClubOSV1-backend/src/routes/openphone*.ts 2>/dev/null | wc -l)"
echo "Health routes: $(ls ClubOSV1-backend/src/routes/health*.ts 2>/dev/null | wc -l)"

echo ""
echo "## Security Scan"
echo "---------------------------------"

echo "### Console.log usage (potential data leaks)"
echo "Backend: $(grep -r "console.log" ClubOSV1-backend/src --include="*.ts" | wc -l) instances"
echo "Frontend: $(grep -r "console.log" ClubOSV1-frontend/src --include="*.tsx" --include="*.ts" | wc -l) instances"

echo "### localStorage usage (XSS vulnerable)"
echo "$(grep -r "localStorage" ClubOSV1-frontend/src --include="*.tsx" --include="*.ts" | wc -l) instances"

echo "### Hardcoded secrets scan"
echo "Checking for API keys..."
grep -r "api[_-]?key" ClubOSV1-backend/src --include="*.ts" -i | grep -v "process.env" | head -5

echo ""
echo "## Performance Issues"
echo "---------------------------------"

echo "### SELECT * queries (inefficient)"
echo "$(grep -r "SELECT \*" ClubOSV1-backend/src --include="*.ts" --include="*.sql" | wc -l) instances found"

echo "### Missing async/await patterns"
echo "Callbacks without async: $(grep -r "callback" ClubOSV1-backend/src --include="*.ts" | grep -v "async" | wc -l)"

echo ""
echo "## Test Coverage"
echo "---------------------------------"

echo "### Test files"
echo "Backend tests: $(find ClubOSV1-backend/src/__tests__ -name "*.test.ts" 2>/dev/null | wc -l)"
echo "Frontend tests: $(find ClubOSV1-frontend/src/__tests__ -name "*.test.tsx" 2>/dev/null | wc -l)"

echo ""
echo "## Dependency Analysis"
echo "---------------------------------"

echo "### Outdated packages (Backend)"
cd ClubOSV1-backend && npm outdated --depth=0 2>/dev/null | head -10
cd ..

echo ""
echo "### Bundle size (Frontend)"
if [ -d "ClubOSV1-frontend/.next" ]; then
    echo "Build size: $(du -sh ClubOSV1-frontend/.next 2>/dev/null | cut -f1)"
fi

echo ""
echo "## Recommendations"
echo "---------------------------------"
echo "1. FIX IMMEDIATELY: Resolve duplicate migration files"
echo "2. SECURITY: Remove all console.log statements"
echo "3. PERFORMANCE: Replace SELECT * with specific columns"
echo "4. ARCHITECTURE: Consolidate duplicate route files"
echo "5. TESTING: Implement minimum 60% code coverage"
echo "6. MONITORING: Add structured logging (Winston/Pino)"
echo "7. DEPLOYMENT: Create staging environment"

echo ""
echo "## Complexity Score"
echo "---------------------------------"

total_files=$(find . -name "*.ts" -o -name "*.tsx" | wc -l)
total_lines=$(find . -name "*.ts" -o -name "*.tsx" -exec wc -l {} + | tail -1 | awk '{print $1}')

echo "Total files: $total_files"
echo "Total lines of code: $total_lines"
echo "Average file size: $((total_lines / total_files)) lines"

if [ $total_files -gt 500 ]; then
    echo "⚠️  WARNING: High complexity - consider refactoring"
fi

echo ""
echo "==================================="
echo "Audit Complete"
echo "==================================="
