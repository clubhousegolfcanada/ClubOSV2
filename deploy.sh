#!/bin/bash

# ClubOS Deployment Script

echo "🚀 Starting ClubOS Deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "package.json" ] || [ ! -d "ClubOSV1-frontend" ] || [ ! -d "ClubOSV1-backend" ]; then
    echo "❌ Please run this script from the ClubOS root directory"
    exit 1
fi

echo -e "${BLUE}Prerequisites:${NC}"
echo "1. GitHub repository created and code pushed"
echo "2. Vercel account created"
echo "3. Railway account created"
echo ""
read -p "Press enter to continue..."

# Frontend Deployment
echo -e "\n${GREEN}📦 Frontend Deployment (Vercel)${NC}"
echo "1. Go to https://vercel.com/new"
echo "2. Import your GitHub repository"
echo "3. Set root directory to: ClubOSV1-frontend"
echo "4. Add these environment variables:"
echo ""
cat << EOF
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.railway.app/api
NEXT_PUBLIC_THEME=dark
NEXT_PUBLIC_SPLASHTOP_URL=https://my.splashtop.com
NEXT_PUBLIC_SKEDDA_URL=https://yourlocation.skedda.com
NEXT_PUBLIC_HUBSPOT_URL=https://app.hubspot.com
NEXT_PUBLIC_UNIFI_URL=https://unifi.ui.com
NEXT_PUBLIC_STRIPE_URL=https://dashboard.stripe.com
NEXT_PUBLIC_TRACKMAN_URL=https://portal.trackman.com
NEXT_PUBLIC_GOOGLE_DRIVE_URL=https://drive.google.com
EOF

echo -e "\n${YELLOW}Frontend URL will be: https://clubos.vercel.app${NC}"
read -p "Press enter when frontend is deployed..."

# Backend Deployment
echo -e "\n${GREEN}🚂 Backend Deployment (Railway)${NC}"
cd ClubOSV1-backend

# Check for Railway CLI
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo "1. Login to Railway:"
railway login

echo -e "\n2. Initialize Railway project:"
railway init

echo -e "\n3. Add environment variables in Railway dashboard"
echo "   Copy from .env.example and update values"

echo -e "\n4. Deploy to Railway:"
railway up

echo -e "\n${YELLOW}Your backend URL will be shown after deployment${NC}"
echo "Update your Vercel frontend with the backend URL!"

cd ..

echo -e "\n${GREEN}✅ Deployment Instructions Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update frontend NEXT_PUBLIC_API_URL with Railway backend URL"
echo "2. Redeploy frontend on Vercel"
echo "3. Test the application"
echo "4. Create admin user using the API"
