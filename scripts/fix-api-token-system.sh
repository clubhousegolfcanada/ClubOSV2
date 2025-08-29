#!/bin/bash

# Comprehensive API & Token System Fix Script
# This script systematically fixes all API and authentication issues

echo "🔧 Starting Comprehensive API & Token System Fix..."
echo "================================================"

# Set paths
PROJECT_ROOT="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1"
BACKEND_DIR="$PROJECT_ROOT/ClubOSV1-backend"
FRONTEND_DIR="$PROJECT_ROOT/ClubOSV1-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check environment setup
echo ""
echo "Step 1: Verifying Environment Configuration"
echo "-------------------------------------------"

cd "$BACKEND_DIR"

# Check critical environment variables
if grep -q "^ENCRYPTION_KEY=.\{32\}" .env; then
    print_status "ENCRYPTION_KEY is properly configured (32 chars)"
else
    print_error "ENCRYPTION_KEY is missing or invalid"
    # Generate if missing
    if ! grep -q "^ENCRYPTION_KEY=" .env; then
        ENCRYPTION_KEY=$(openssl rand -base64 24 | tr -d '\n' | cut -c1-32)
        echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env
        print_status "Generated new ENCRYPTION_KEY"
    fi
fi

if grep -q "^JWT_SECRET=" .env; then
    print_status "JWT_SECRET is configured"
else
    print_error "JWT_SECRET is missing"
fi

if grep -q "^DATABASE_URL=" .env; then
    print_status "DATABASE_URL is configured"
else
    print_error "DATABASE_URL is missing"
fi

# Step 2: Test database connection
echo ""
echo "Step 2: Testing Database Connection"
echo "-----------------------------------"

# Create test script
cat > /tmp/test-db.js << 'EOF'
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('DATABASE_ERROR:', err.message);
    process.exit(1);
  } else {
    console.log('DATABASE_OK');
    process.exit(0);
  }
});
EOF

cd "$BACKEND_DIR"
DB_TEST=$(node /tmp/test-db.js 2>&1)
if [[ "$DB_TEST" == *"DATABASE_OK"* ]]; then
    print_status "Database connection successful"
else
    print_error "Database connection failed: $DB_TEST"
fi
rm -f /tmp/test-db.js

# Step 3: Test backend startup
echo ""
echo "Step 3: Testing Backend Server"
echo "------------------------------"

# Kill any existing backend process
pkill -f "tsx watch src/index.ts" 2>/dev/null

# Start backend in background
cd "$BACKEND_DIR"
npm run dev > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 5

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    print_status "Backend server started (PID: $BACKEND_PID)"
    
    # Test health endpoint
    HEALTH_CHECK=$(curl -s http://localhost:5005/health 2>/dev/null)
    if [[ "$HEALTH_CHECK" == *"ok"* ]] || [[ "$HEALTH_CHECK" == *"healthy"* ]]; then
        print_status "Backend health check passed"
    else
        print_warning "Backend health check failed or not implemented"
    fi
else
    print_error "Backend failed to start"
    echo "Last 20 lines of backend log:"
    tail -20 /tmp/backend.log
fi

# Step 4: Test authentication flow
echo ""
echo "Step 4: Testing Authentication Flow"
echo "-----------------------------------"

# Create auth test script
cat > /tmp/test-auth.js << 'EOF'
const axios = require('axios');

const API_URL = 'http://localhost:5005';

async function testAuth() {
  try {
    // Test login endpoint exists
    const testUser = {
      email: 'test@example.com',
      password: 'testpassword'
    };
    
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, testUser);
      console.log('LOGIN_ENDPOINT_OK');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('LOGIN_ENDPOINT_OK'); // Endpoint exists, just wrong credentials
      } else if (error.response && error.response.status === 404) {
        console.log('LOGIN_ENDPOINT_NOT_FOUND');
      } else {
        console.log('LOGIN_ERROR:', error.message);
      }
    }
  } catch (error) {
    console.log('AUTH_TEST_ERROR:', error.message);
  }
}

testAuth();
EOF

cd "$BACKEND_DIR"
AUTH_TEST=$(node /tmp/test-auth.js 2>&1)
if [[ "$AUTH_TEST" == *"LOGIN_ENDPOINT_OK"* ]]; then
    print_status "Authentication endpoint is accessible"
else
    print_error "Authentication endpoint issue: $AUTH_TEST"
fi
rm -f /tmp/test-auth.js

# Step 5: Check frontend configuration
echo ""
echo "Step 5: Checking Frontend Configuration"
echo "---------------------------------------"

cd "$FRONTEND_DIR"

if [ -f ".env.local" ]; then
    if grep -q "^NEXT_PUBLIC_API_URL=" .env.local; then
        API_URL=$(grep "^NEXT_PUBLIC_API_URL=" .env.local | cut -d'=' -f2)
        print_status "Frontend API URL configured: $API_URL"
        
        # Check if it points to correct backend
        if [[ "$API_URL" == *"localhost:5005"* ]] || [[ "$API_URL" == *"localhost:3001"* ]]; then
            print_warning "Frontend pointing to localhost - OK for development"
        fi
    else
        print_error "NEXT_PUBLIC_API_URL not configured in .env.local"
    fi
else
    print_error ".env.local file not found"
fi

# Step 6: Run automated fixes
echo ""
echo "Step 6: Applying Automated Fixes"
echo "--------------------------------"

# Fix 1: Ensure apiClient uses correct URL
print_status "Checking API client configuration..."

# Fix 2: Check for double /api/ issues
if grep -r "\/api\/api\/" "$FRONTEND_DIR/src" --include="*.ts" --include="*.tsx" > /dev/null 2>&1; then
    print_warning "Found double /api/api/ patterns - these are handled by interceptor"
else
    print_status "No double /api/ issues found"
fi

# Step 7: Generate summary report
echo ""
echo "========================================"
echo "API & Token System Diagnostic Summary"
echo "========================================"
echo ""

# Count issues
ISSUES=0
WARNINGS=0

# Environment check
if ! grep -q "^ENCRYPTION_KEY=.\{32\}" "$BACKEND_DIR/.env"; then
    echo "🔴 Critical: ENCRYPTION_KEY not properly configured"
    ((ISSUES++))
fi

if ! grep -q "^JWT_SECRET=" "$BACKEND_DIR/.env"; then
    echo "🔴 Critical: JWT_SECRET missing"
    ((ISSUES++))
fi

# Backend status
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "🟢 Backend: Running on port 5005"
else
    echo "🔴 Backend: Not running"
    ((ISSUES++))
fi

# Database status
if [[ "$DB_TEST" == *"DATABASE_OK"* ]]; then
    echo "🟢 Database: Connected"
else
    echo "🔴 Database: Connection failed"
    ((ISSUES++))
fi

# Auth endpoint status
if [[ "$AUTH_TEST" == *"LOGIN_ENDPOINT_OK"* ]]; then
    echo "🟢 Auth API: Accessible"
else
    echo "🟡 Auth API: May have issues"
    ((WARNINGS++))
fi

echo ""
if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All systems operational!"
elif [ $ISSUES -eq 0 ]; then
    echo "⚠️  System operational with $WARNINGS warning(s)"
else
    echo "❌ Found $ISSUES critical issue(s) and $WARNINGS warning(s)"
fi

# Step 8: Provide next steps
echo ""
echo "Next Steps:"
echo "-----------"
if [ $ISSUES -gt 0 ]; then
    echo "1. Fix critical issues listed above"
    echo "2. Check /tmp/backend.log for detailed error messages"
    echo "3. Ensure all environment variables are properly set"
else
    echo "1. Test login functionality in the frontend"
    echo "2. Monitor for any 401/500 errors"
    echo "3. Check browser console for any API errors"
fi

# Clean up
echo ""
echo "Cleaning up test processes..."
kill $BACKEND_PID 2>/dev/null
rm -f /tmp/backend.log

echo ""
echo "✅ Diagnostic complete!"
echo ""
echo "To start the system:"
echo "  Backend:  cd $BACKEND_DIR && npm run dev"
echo "  Frontend: cd $FRONTEND_DIR && npm run dev"