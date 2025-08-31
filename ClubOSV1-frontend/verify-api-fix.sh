#!/bin/bash

echo "=== API Fix Verification Script ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for double /api/api patterns
echo "1. Checking for double /api/api patterns..."
DOUBLE_API=$(rg -n "/api/api" src --type ts --type tsx --type js --type jsx 2>/dev/null | grep -v "FIXED:" | grep -v "prevent double")
if [ -z "$DOUBLE_API" ]; then
  echo -e "${GREEN}✓ No double /api/api patterns found${NC}"
else
  echo -e "${RED}✗ Found double /api/api patterns:${NC}"
  echo "$DOUBLE_API"
fi

# Check for direct axios calls with API_URL
echo ""
echo "2. Checking for direct axios calls with API_URL..."
DIRECT_AXIOS=$(rg "axios\.(get|post|put|delete|patch).*API_URL" src --type ts --type tsx 2>/dev/null)
if [ -z "$DIRECT_AXIOS" ]; then
  echo -e "${GREEN}✓ No direct axios calls with API_URL found${NC}"
else
  echo -e "${RED}✗ Found direct axios calls with API_URL:${NC}"
  echo "$DIRECT_AXIOS"
fi

# Check that resolveApi.ts exists
echo ""
echo "3. Checking resolveApi.ts exists..."
if [ -f "src/utils/resolveApi.ts" ]; then
  echo -e "${GREEN}✓ resolveApi.ts exists${NC}"
else
  echo -e "${RED}✗ resolveApi.ts not found${NC}"
fi

# Check that http.ts exists
echo ""
echo "4. Checking http.ts exists..."
if [ -f "src/api/http.ts" ]; then
  echo -e "${GREEN}✓ http.ts exists${NC}"
else
  echo -e "${RED}✗ http.ts not found${NC}"
fi

# Check for imports of http client
echo ""
echo "5. Checking http client usage..."
HTTP_IMPORTS=$(rg "import.*http.*from.*@/api/http" src --type ts --type tsx 2>/dev/null | wc -l)
echo -e "${GREEN}✓ Found $HTTP_IMPORTS files using http client${NC}"

# Check for any remaining axios imports that aren't http client
echo ""
echo "6. Checking for remaining direct axios imports..."
AXIOS_IMPORTS=$(rg "import axios from 'axios'" src --type ts --type tsx 2>/dev/null | grep -v "http.ts")
if [ -z "$AXIOS_IMPORTS" ]; then
  echo -e "${GREEN}✓ No problematic axios imports found${NC}"
else
  echo -e "${YELLOW}⚠ Found axios imports (may be okay if wrapped properly):${NC}"
  echo "$AXIOS_IMPORTS" | head -5
fi

echo ""
echo "=== Verification Complete ==="#