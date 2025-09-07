#!/bin/bash

# Test Parallel Routes - V1 and V2
# This script tests both old and new endpoints to ensure they work in parallel

echo "========================================"
echo "Testing Parallel Routes Implementation"
echo "========================================"
echo ""

BASE_URL="http://localhost:5005"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -X GET "$BASE_URL$endpoint" -H "Content-Type: application/json")
    else
        response=$(curl -s -X POST "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data")
    fi
    
    # Check if response contains error
    if echo "$response" | grep -q "error\|Error\|failed"; then
        echo -e "${RED}❌ Failed${NC}"
        echo "Response: $response"
    else
        echo -e "${GREEN}✅ Success${NC}"
        echo "Response: ${response:0:100}..." # First 100 chars
    fi
    echo "----------------------------------------"
    echo ""
}

# 1. Test Version Discovery
echo -e "${YELLOW}=== VERSION DISCOVERY ===${NC}"
test_endpoint "GET" "/api/version" "" "Version Discovery Endpoint"

# 2. Test Health Endpoints
echo -e "${YELLOW}=== HEALTH ENDPOINTS ===${NC}"
test_endpoint "GET" "/api/public/health" "" "V1 Public Health"
test_endpoint "GET" "/api/v2/health/health" "" "V2 Health (Refactored)"

# 3. Test Auth Endpoints
echo -e "${YELLOW}=== AUTH ENDPOINTS ===${NC}"

# V1 Auth
test_endpoint "POST" "/api/auth/login" \
    '{"email":"admin@clubos.com","password":"wrong"}' \
    "V1 Auth Login (Invalid Credentials)"

# V2 Auth
test_endpoint "POST" "/api/v2/auth/login" \
    '{"email":"admin@clubos.com","password":"wrong"}' \
    "V2 Auth Login (Invalid Credentials)"

# 4. Test Response Format Consistency
echo -e "${YELLOW}=== RESPONSE FORMAT COMPARISON ===${NC}"

echo "Comparing V1 and V2 response formats..."

# Get V1 response
v1_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}')

# Get V2 response
v2_response=$(curl -s -X POST "$BASE_URL/api/v2/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}')

echo "V1 Response Structure:"
echo "$v1_response" | python3 -m json.tool 2>/dev/null | head -10 || echo "$v1_response" | head -10

echo ""
echo "V2 Response Structure:"
echo "$v2_response" | python3 -m json.tool 2>/dev/null | head -10 || echo "$v2_response" | head -10

# 5. Performance Comparison
echo ""
echo -e "${YELLOW}=== PERFORMANCE COMPARISON ===${NC}"

echo "Testing V1 Auth performance (10 requests)..."
v1_time=$(time (for i in {1..10}; do
    curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' > /dev/null
done) 2>&1 | grep real | awk '{print $2}')

echo "Testing V2 Auth performance (10 requests)..."
v2_time=$(time (for i in {1..10}; do
    curl -s -X POST "$BASE_URL/api/v2/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' > /dev/null
done) 2>&1 | grep real | awk '{print $2}')

echo "V1 Time: ${v1_time:-N/A}"
echo "V2 Time: ${v2_time:-N/A}"

# 6. Summary
echo ""
echo -e "${YELLOW}========================================"
echo "TEST SUMMARY"
echo "========================================${NC}"

# Check if both routes are accessible
v1_accessible=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/auth/login" -X POST -H "Content-Type: application/json" -d '{}')
v2_accessible=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v2/auth/login" -X POST -H "Content-Type: application/json" -d '{}')

echo "V1 Routes Accessible: $([ "$v1_accessible" != "000" ] && echo -e "${GREEN}YES${NC}" || echo -e "${RED}NO${NC}") (HTTP $v1_accessible)"
echo "V2 Routes Accessible: $([ "$v2_accessible" != "000" ] && echo -e "${GREEN}YES${NC}" || echo -e "${RED}NO${NC}") (HTTP $v2_accessible)"
echo ""

if [ "$v1_accessible" != "000" ] && [ "$v2_accessible" != "000" ]; then
    echo -e "${GREEN}✅ PARALLEL ROUTING IS WORKING!${NC}"
    echo "Both V1 and V2 endpoints are responding."
else
    echo -e "${RED}❌ PARALLEL ROUTING HAS ISSUES${NC}"
    echo "Please check the server logs for errors."
fi

echo ""
echo "Test completed at $(date)"