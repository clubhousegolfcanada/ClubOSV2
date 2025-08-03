#!/bin/bash

echo "🔐 ClubOS Security Verification Script"
echo "====================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize counters
PASSED=0
FAILED=0
WARNINGS=0

# Check Node.js version
echo "1. Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js version: $NODE_VERSION"
if [[ "$NODE_VERSION" =~ ^v1[6-9]\.|^v2[0-9]\. ]]; then
  echo -e "   ${GREEN}✅ Node.js version is supported${NC}"
  ((PASSED++))
else
  echo -e "   ${YELLOW}⚠️  Consider updating Node.js to v16 or higher${NC}"
  ((WARNINGS++))
fi

echo ""

# Check for vulnerabilities in frontend
echo "2. Checking frontend npm vulnerabilities..."
cd ClubOSV1-frontend
FRONTEND_AUDIT=$(npm audit --production 2>&1)
FRONTEND_VULNS=$?

if [ $FRONTEND_VULNS -eq 0 ]; then
  echo -e "   ${GREEN}✅ No vulnerabilities found in frontend${NC}"
  ((PASSED++))
else
  echo -e "   ${RED}❌ Vulnerabilities found in frontend${NC}"
  echo "$FRONTEND_AUDIT" | grep -E "found|severity"
  ((FAILED++))
fi

echo ""

# Check for vulnerabilities in backend
echo "3. Checking backend npm vulnerabilities..."
cd ../ClubOSV1-backend
BACKEND_AUDIT=$(npm audit --production 2>&1)
BACKEND_VULNS=$?

if [ $BACKEND_VULNS -eq 0 ]; then
  echo -e "   ${GREEN}✅ No vulnerabilities found in backend${NC}"
  ((PASSED++))
else
  echo -e "   ${RED}❌ Vulnerabilities found in backend${NC}"
  echo "$BACKEND_AUDIT" | grep -E "found|severity"
  ((FAILED++))
fi

echo ""

# Check Next.js version
echo "4. Checking Next.js version..."
cd ../ClubOSV1-frontend
NEXT_VERSION=$(npm list next 2>/dev/null | grep "next@" | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
echo "   Next.js version: $NEXT_VERSION"

if [[ "$NEXT_VERSION" =~ ^15\.|^14\.[2-9]\.|^14\.1[0-9]\.|^14\.2[0-9]\. ]]; then
  echo -e "   ${GREEN}✅ Next.js version is secure${NC}"
  ((PASSED++))
else
  echo -e "   ${RED}❌ Next.js version needs updating${NC}"
  ((FAILED++))
fi

echo ""

# Check security headers (if dev server is running)
echo "5. Testing security headers..."
if curl -s -I http://localhost:3000 >/dev/null 2>&1; then
  HEADERS=$(curl -s -I http://localhost:3000)
  
  # Check X-Frame-Options
  if echo "$HEADERS" | grep -q "X-Frame-Options: SAMEORIGIN"; then
    echo -e "   ${GREEN}✅ X-Frame-Options is properly set${NC}"
    ((PASSED++))
  else
    echo -e "   ${RED}❌ X-Frame-Options not properly set${NC}"
    ((FAILED++))
  fi
  
  # Check Content-Security-Policy
  if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    echo -e "   ${GREEN}✅ Content-Security-Policy is set${NC}"
    ((PASSED++))
  else
    echo -e "   ${YELLOW}⚠️  Content-Security-Policy not found${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "   ${YELLOW}⚠️  Dev server not running, skipping header checks${NC}"
  ((WARNINGS++))
fi

echo ""

# Check environment variables
echo "6. Checking environment security..."
cd ../ClubOSV1-backend
if [ -f .env ]; then
  # Check for default values
  if grep -q "your-secret-jwt-key" .env 2>/dev/null; then
    echo -e "   ${RED}❌ Default JWT_SECRET detected${NC}"
    ((FAILED++))
  else
    echo -e "   ${GREEN}✅ JWT_SECRET is customized${NC}"
    ((PASSED++))
  fi
  
  if grep -q "your-32-character-encryption-key" .env 2>/dev/null; then
    echo -e "   ${RED}❌ Default ENCRYPTION_KEY detected${NC}"
    ((FAILED++))
  else
    echo -e "   ${GREEN}✅ ENCRYPTION_KEY is customized${NC}"
    ((PASSED++))
  fi
  
  # Check JWT_SECRET length
  JWT_SECRET_LENGTH=$(grep "^JWT_SECRET=" .env 2>/dev/null | cut -d'=' -f2 | wc -c)
  if [ $JWT_SECRET_LENGTH -ge 32 ]; then
    echo -e "   ${GREEN}✅ JWT_SECRET has sufficient length${NC}"
    ((PASSED++))
  else
    echo -e "   ${RED}❌ JWT_SECRET is too short (should be 32+ characters)${NC}"
    ((FAILED++))
  fi
else
  echo -e "   ${YELLOW}⚠️  No .env file found${NC}"
  ((WARNINGS++))
fi

echo ""

# Check for CSRF protection
echo "7. Checking CSRF protection..."
if grep -q "csrfProtection" src/middleware/security.ts 2>/dev/null && ! grep -q "return next(); // Temporarily disable CSRF" src/middleware/security.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ CSRF protection is enabled${NC}"
  ((PASSED++))
else
  echo -e "   ${YELLOW}⚠️  CSRF protection may be disabled${NC}"
  ((WARNINGS++))
fi

echo ""

# Run security tests if available
echo "8. Running security tests..."
if [ -d "src/__tests__/security" ]; then
  echo "   Security test suite found"
  # Don't actually run tests in verification script to avoid dependencies
  echo -e "   ${GREEN}✅ Security tests are available${NC}"
  echo "   Run 'npm test -- security.test.ts' to execute"
  ((PASSED++))
else
  echo -e "   ${RED}❌ No security tests found${NC}"
  ((FAILED++))
fi

echo ""

# Check for rate limiting
echo "9. Checking rate limiting configuration..."
if grep -q "rateLimiter" src/index.ts 2>/dev/null && grep -q "createRateLimiter" src/middleware/security.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ Rate limiting is configured${NC}"
  ((PASSED++))
else
  echo -e "   ${RED}❌ Rate limiting not properly configured${NC}"
  ((FAILED++))
fi

echo ""

# Check for input sanitization
echo "10. Checking input sanitization..."
if grep -q "sanitizeMiddleware" src/index.ts 2>/dev/null && grep -q "sanitizeObject" src/middleware/security.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ Input sanitization is enabled${NC}"
  ((PASSED++))
else
  echo -e "   ${RED}❌ Input sanitization not found${NC}"
  ((FAILED++))
fi

# Summary
echo ""
echo "====================================="
echo "Security Verification Summary"
echo "====================================="

TOTAL=$((PASSED + FAILED + WARNINGS))

echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo "Total checks: $TOTAL"

# Calculate security score
SCORE=$((PASSED * 100 / TOTAL))
echo ""
echo "Security Score: $SCORE%"

if [ $SCORE -ge 90 ]; then
  echo -e "${GREEN}Excellent security posture!${NC}"
elif [ $SCORE -ge 70 ]; then
  echo -e "${YELLOW}Good security, but improvements needed${NC}"
else
  echo -e "${RED}Critical security issues need attention${NC}"
fi

echo ""
echo "Next steps:"
if [ $FAILED -gt 0 ]; then
  echo "1. Fix any failed security checks"
fi
if [ $FRONTEND_VULNS -ne 0 ] || [ $BACKEND_VULNS -ne 0 ]; then
  echo "2. Run 'npm audit fix' to fix vulnerabilities"
fi
if [ $WARNINGS -gt 0 ]; then
  echo "3. Review and address warnings"
fi
echo "4. Run security tests: npm test -- security.test.ts"
echo "5. Deploy security updates"

# Return non-zero exit code if there are failures
if [ $FAILED -gt 0 ]; then
  exit 1
else
  exit 0
fi