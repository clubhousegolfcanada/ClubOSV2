#!/bin/bash

echo "🔍 ClubOS Feature Testing Script"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1. Checking backend status..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    curl -s http://localhost:3001/health | jq .
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo "  Run: cd ClubOSV1-backend && npm run dev"
fi
echo ""

# Check if frontend is running
echo "2. Checking frontend status..."
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend is not running${NC}"
    echo "  Run: cd ClubOSV1-frontend && npm run dev"
fi
echo ""

# Test basic routing
echo "3. Testing request routing..."
echo "   a) Testing Booking route:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "I need to book bay 3 for tomorrow", "routePreference": "Auto"}' | jq -r '.data.botRoute // .error')
if [ "$RESPONSE" = "booking" ]; then
    echo -e "${GREEN}   ✓ Booking routing works${NC}"
else
    echo -e "${RED}   ✗ Booking routing failed: $RESPONSE${NC}"
fi

echo "   b) Testing Emergency route:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "There is water leaking from ceiling", "routePreference": "Auto"}' | jq -r '.data.botRoute // .error')
if [ "$RESPONSE" = "emergency" ]; then
    echo -e "${GREEN}   ✓ Emergency routing works${NC}"
else
    echo -e "${RED}   ✗ Emergency routing failed: $RESPONSE${NC}"
fi

echo "   c) Testing Tech route:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "TrackMan screen is frozen", "routePreference": "Auto"}' | jq -r '.data.botRoute // .error')
if [ "$RESPONSE" = "tech" ]; then
    echo -e "${GREEN}   ✓ Tech routing works${NC}"
else
    echo -e "${RED}   ✗ Tech routing failed: $RESPONSE${NC}"
fi
echo ""

# Test knowledge base
echo "4. Testing knowledge base..."
RESPONSE=$(curl -s http://localhost:3001/api/knowledge | jq -r '.count // .error')
if [ "$RESPONSE" = "5" ]; then
    echo -e "${GREEN}✓ Knowledge base loaded (5 bases)${NC}"
else
    echo -e "${YELLOW}⚠ Knowledge base issue: $RESPONSE${NC}"
fi
echo ""

# Test validation
echo "5. Testing input validation..."
echo "   a) Testing empty request:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "", "routePreference": "Auto"}' | jq -r '.error // "success"')
if [ "$RESPONSE" != "success" ]; then
    echo -e "${GREEN}   ✓ Empty request validation works${NC}"
else
    echo -e "${RED}   ✗ Empty request validation failed${NC}"
fi

echo "   b) Testing short request:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "help", "routePreference": "Auto"}' | jq -r '.error // "success"')
if [ "$RESPONSE" != "success" ]; then
    echo -e "${GREEN}   ✓ Short request validation works${NC}"
else
    echo -e "${RED}   ✗ Short request validation failed${NC}"
fi
echo ""

# Check system configuration
echo "6. Checking system configuration..."
if [ -f "ClubOSV1-backend/.env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    
    # Check key configurations
    if grep -q "ENABLE_DEMO_MODE=true" ClubOSV1-backend/.env; then
        echo -e "${YELLOW}  ⚠ Demo mode is enabled${NC}"
    else
        echo -e "${GREEN}  ✓ Production mode${NC}"
    fi
    
    if grep -q "OPENAI_API_KEY=sk-demo" ClubOSV1-backend/.env; then
        echo -e "${YELLOW}  ⚠ Using demo API key${NC}"
    else
        echo -e "${GREEN}  ✓ Real API key configured${NC}"
    fi
else
    echo -e "${RED}✗ .env file missing${NC}"
fi
echo ""

# Test GPT webhook endpoint
echo "7. Testing GPT webhook endpoint..."
RESPONSE=$(curl -s http://localhost:3001/api/gpt-webhook/webhook/health | jq -r '.status // .error')
if [ "$RESPONSE" = "healthy" ]; then
    echo -e "${GREEN}✓ GPT webhook endpoint healthy${NC}"
else
    echo -e "${RED}✗ GPT webhook issue: $RESPONSE${NC}"
fi
echo ""

# Summary
echo "================================"
echo "Summary:"
echo "- Use http://localhost:3000 to access the UI"
echo "- Backend API is at http://localhost:3001"
echo "- Check FEATURE-REVIEW.md for detailed testing"
echo ""

# Test specific knowledge base query
echo "8. Testing specific KB queries..."
echo "   Testing 'Screen frozen' solution:"
curl -s -X POST http://localhost:3001/api/llm/request \
  -H "Content-Type: application/json" \
  -d '{"requestDescription": "Screen frozen", "location": "Bay 3", "routePreference": "Auto"}' | jq '.data.llmResponse'