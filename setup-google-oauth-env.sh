#!/bin/bash

# Google OAuth Environment Setup Script
echo "🔐 Google OAuth Environment Setup"
echo "================================="
echo ""
echo "This script will help you set up Google OAuth environment variables"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Enter your Google OAuth credentials${NC}"
echo "Get these from: https://console.cloud.google.com/apis/credentials"
echo ""

# Get Client ID
echo -n "Enter your Google Client ID (ends with .apps.googleusercontent.com): "
read GOOGLE_CLIENT_ID

# Get Client Secret
echo -n "Enter your Google Client Secret: "
read -s GOOGLE_CLIENT_SECRET
echo ""

# Confirm Railway backend URL
echo ""
echo -e "${YELLOW}Step 2: Confirm your Railway backend URL${NC}"
echo "Default: https://clubos-backend.up.railway.app"
echo -n "Press Enter to use default or type your custom URL: "
read CUSTOM_URL

if [ -z "$CUSTOM_URL" ]; then
    BACKEND_URL="https://clubos-backend.up.railway.app"
else
    BACKEND_URL="$CUSTOM_URL"
fi

GOOGLE_REDIRECT_URI="${BACKEND_URL}/api/auth/google/callback"

echo ""
echo -e "${GREEN}Configuration Summary:${NC}"
echo "Client ID: ${GOOGLE_CLIENT_ID:0:20}..."
echo "Client Secret: [HIDDEN]"
echo "Redirect URI: $GOOGLE_REDIRECT_URI"

# Create backend .env entries
echo ""
echo -e "${BLUE}Backend Environment Variables (.env):${NC}"
cat << EOF > google-oauth-backend.env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=$GOOGLE_REDIRECT_URI

# Optional: Add test emails for development (comma-separated)
# GOOGLE_TEST_EMAILS=test@example.com
EOF

echo "Created: google-oauth-backend.env"

# Create frontend .env entries
echo ""
echo -e "${BLUE}Frontend Environment Variables (.env.local):${NC}"
cat << EOF > google-oauth-frontend.env
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
NEXT_PUBLIC_FRONTEND_URL=https://clubos-frontend.vercel.app
EOF

echo "Created: google-oauth-frontend.env"

# Railway CLI commands
echo ""
echo -e "${YELLOW}Step 3: Add to Railway (Backend)${NC}"
echo "Option A: Use Railway CLI (if installed):"
echo -e "${GREEN}cd ClubOSV1-backend${NC}"
echo -e "${GREEN}railway variables set GOOGLE_CLIENT_ID=\"$GOOGLE_CLIENT_ID\"${NC}"
echo -e "${GREEN}railway variables set GOOGLE_CLIENT_SECRET=\"$GOOGLE_CLIENT_SECRET\"${NC}"
echo -e "${GREEN}railway variables set GOOGLE_REDIRECT_URI=\"$GOOGLE_REDIRECT_URI\"${NC}"

echo ""
echo "Option B: Use Railway Dashboard:"
echo "1. Go to https://railway.app"
echo "2. Select your ClubOS backend service"
echo "3. Go to Variables tab"
echo "4. Add the variables from google-oauth-backend.env"

# Vercel instructions
echo ""
echo -e "${YELLOW}Step 4: Add to Vercel (Frontend)${NC}"
echo "1. Go to https://vercel.com/dashboard"
echo "2. Select your ClubOS frontend project"
echo "3. Go to Settings → Environment Variables"
echo "4. Add:"
echo "   NEXT_PUBLIC_GOOGLE_CLIENT_ID = $GOOGLE_CLIENT_ID"
echo "   NEXT_PUBLIC_FRONTEND_URL = https://clubos-frontend.vercel.app"

# Local development
echo ""
echo -e "${YELLOW}Step 5: Local Development${NC}"
echo "1. Copy contents of google-oauth-backend.env to ClubOSV1-backend/.env"
echo "2. Copy contents of google-oauth-frontend.env to ClubOSV1-frontend/.env.local"

echo ""
echo -e "${GREEN}✅ Setup files created!${NC}"
echo ""
echo "Next steps:"
echo "1. Add variables to Railway and Vercel"
echo "2. Run database migration: railway run npm run db:migrate"
echo "3. Restart your services"
echo "4. Test at https://clubos-frontend.vercel.app/login"