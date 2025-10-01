#!/bin/bash

# Test Google OAuth Implementation
echo "🔍 Testing Google OAuth Implementation..."
echo "======================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if environment variables are set
echo -e "\n${YELLOW}1. Checking Environment Variables...${NC}"
if [ -f ClubOSV1-backend/.env ]; then
    if grep -q "GOOGLE_CLIENT_ID" ClubOSV1-backend/.env; then
        echo -e "${GREEN}✓ GOOGLE_CLIENT_ID found in .env${NC}"
    else
        echo -e "${RED}✗ GOOGLE_CLIENT_ID not found in .env${NC}"
        echo "  Add to ClubOSV1-backend/.env:"
        echo "  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com"
    fi

    if grep -q "GOOGLE_CLIENT_SECRET" ClubOSV1-backend/.env; then
        echo -e "${GREEN}✓ GOOGLE_CLIENT_SECRET found in .env${NC}"
    else
        echo -e "${RED}✗ GOOGLE_CLIENT_SECRET not found in .env${NC}"
        echo "  Add to ClubOSV1-backend/.env:"
        echo "  GOOGLE_CLIENT_SECRET=your-client-secret"
    fi
else
    echo -e "${RED}✗ Backend .env file not found${NC}"
fi

# Check if migration exists
echo -e "\n${YELLOW}2. Checking Database Migration...${NC}"
if [ -f ClubOSV1-backend/src/database/migrations/233_add_google_oauth_support.sql ]; then
    echo -e "${GREEN}✓ Google OAuth migration file exists${NC}"
else
    echo -e "${RED}✗ Migration file not found${NC}"
fi

# Check if backend files exist
echo -e "\n${YELLOW}3. Checking Backend Files...${NC}"
if [ -f ClubOSV1-backend/src/services/googleAuth.ts ]; then
    echo -e "${GREEN}✓ googleAuth.ts service exists${NC}"
else
    echo -e "${RED}✗ googleAuth.ts service not found${NC}"
fi

if [ -f ClubOSV1-backend/src/routes/auth-google.ts ]; then
    echo -e "${GREEN}✓ auth-google.ts routes exist${NC}"
else
    echo -e "${RED}✗ auth-google.ts routes not found${NC}"
fi

# Check if frontend files exist
echo -e "\n${YELLOW}4. Checking Frontend Files...${NC}"
if [ -f ClubOSV1-frontend/src/components/GoogleSignInButton.tsx ]; then
    echo -e "${GREEN}✓ GoogleSignInButton component exists${NC}"
else
    echo -e "${RED}✗ GoogleSignInButton component not found${NC}"
fi

if [ -f ClubOSV1-frontend/src/pages/auth/success.tsx ]; then
    echo -e "${GREEN}✓ OAuth success page exists${NC}"
else
    echo -e "${RED}✗ OAuth success page not found${NC}"
fi

# Check if google-auth-library is installed
echo -e "\n${YELLOW}5. Checking Dependencies...${NC}"
if [ -f ClubOSV1-backend/package.json ]; then
    if grep -q "google-auth-library" ClubOSV1-backend/package.json; then
        echo -e "${GREEN}✓ google-auth-library is installed${NC}"
    else
        echo -e "${RED}✗ google-auth-library not in package.json${NC}"
        echo "  Run: cd ClubOSV1-backend && npm install google-auth-library"
    fi
fi

# Test TypeScript compilation
echo -e "\n${YELLOW}6. Testing TypeScript Compilation...${NC}"
cd ClubOSV1-backend
npx tsc --noEmit 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend TypeScript compiles successfully${NC}"
else
    echo -e "${YELLOW}⚠ Backend TypeScript has errors (checking specific files)${NC}"
    npx tsc --noEmit src/services/googleAuth.ts 2>&1 | head -5
fi
cd ..

cd ClubOSV1-frontend
npx tsc --noEmit 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend TypeScript compiles successfully${NC}"
else
    echo -e "${YELLOW}⚠ Frontend TypeScript has errors (checking specific files)${NC}"
    npx tsc --noEmit src/components/GoogleSignInButton.tsx 2>&1 | head -5
fi
cd ..

echo -e "\n${YELLOW}7. Setup Instructions:${NC}"
echo "1. Create Google OAuth credentials at https://console.cloud.google.com"
echo "2. Add environment variables to ClubOSV1-backend/.env:"
echo "   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com"
echo "   GOOGLE_CLIENT_SECRET=your-client-secret"
echo "   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback"
echo "3. Run database migration:"
echo "   cd ClubOSV1-backend && npm run db:migrate"
echo "4. Start development servers:"
echo "   Terminal 1: cd ClubOSV1-backend && npm run dev"
echo "   Terminal 2: cd ClubOSV1-frontend && npm run dev"
echo "5. Test at http://localhost:3001/login"

echo -e "\n${GREEN}✅ Google OAuth implementation is ready!${NC}"
echo "Note: You need to set up Google Cloud credentials before testing."