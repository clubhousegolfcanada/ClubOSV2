#!/bin/bash

# ClubOS V1 - Quick Security & Quality Audit

echo "=== ClubOS V1 Security & Quality Audit ==="
echo

# Check for hardcoded secrets
echo "🔍 Checking for hardcoded secrets..."
grep -r "sk-" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | grep -v "sk-demo" | grep -v "example" || echo "✅ No OpenAI keys found"
grep -r "password" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | grep -E "(=|:)\s*['\"][^'\"]{8,}['\"]" | grep -v "example" | grep -v "test" || echo "✅ No hardcoded passwords found"

echo
echo "🔍 Checking for disabled security features..."
grep -r "skip.*true" --include="*.ts" --include="*.js" --exclude-dir=node_modules . 2>/dev/null | grep -i "rate" && echo "⚠️  Rate limiting disabled!" || echo "✅ Rate limiting appears enabled"

echo
echo "🔍 Checking for TODO/FIXME comments..."
TODO_COUNT=$(grep -r "TODO\|FIXME" --include="*.ts" --include="*.js" --exclude-dir=node_modules . 2>/dev/null | wc -l)
echo "Found $TODO_COUNT TODO/FIXME comments"

echo
echo "🔍 Checking test coverage..."
SPEC_COUNT=$(find . -name "*.spec.ts" -o -name "*.spec.js" -o -name "*.test.ts" -o -name "*.test.js" | grep -v node_modules | wc -l)
SRC_COUNT=$(find ./ClubOSV1-backend/src -name "*.ts" -o -name "*.js" | grep -v __tests__ | wc -l)
echo "Test files: $SPEC_COUNT"
echo "Source files: $SRC_COUNT"
echo "Coverage ratio: $(echo "scale=2; $SPEC_COUNT / $SRC_COUNT" | bc)%"

echo
echo "🔍 Checking for mixed JS/TS files..."
JS_COUNT=$(find ./ClubOSV1-backend/src -name "*.js" | grep -v __tests__ | wc -l)
TS_COUNT=$(find ./ClubOSV1-backend/src -name "*.ts" | grep -v __tests__ | wc -l)
echo "JavaScript files: $JS_COUNT"
echo "TypeScript files: $TS_COUNT"

echo
echo "🔍 Checking error handling..."
TRY_COUNT=$(grep -r "try\s*{" --include="*.ts" --include="*.js" ./ClubOSV1-backend/src | wc -l)
CATCH_COUNT=$(grep -r "catch\s*(" --include="*.ts" --include="*.js" ./ClubOSV1-backend/src | wc -l)
echo "Try blocks: $TRY_COUNT"
echo "Catch blocks: $CATCH_COUNT"

echo
echo "🔍 Checking for console.log statements..."
CONSOLE_COUNT=$(grep -r "console\.log" --include="*.ts" --include="*.js" ./ClubOSV1-backend/src | grep -v "logger" | wc -l)
echo "console.log statements: $CONSOLE_COUNT (should use logger instead)"

echo
echo "=== Summary ==="
echo "- Rate limiting: Check if disabled for production"
echo "- Test coverage: Very low, needs improvement"
echo "- Mixed JS/TS: Migration incomplete"
echo "- Error handling: Appears adequate"
echo "- Logging: Some console.log usage instead of logger"
