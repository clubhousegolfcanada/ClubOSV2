#!/bin/bash

# ClubOS Development Environment Setup Script
# This script helps new developers get started quickly

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Art Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   ██████╗██╗     ██╗   ██╗██████╗  ██████╗ ███████╗     ║"
echo "║  ██╔════╝██║     ██║   ██║██╔══██╗██╔═══██╗██╔════╝     ║"
echo "║  ██║     ██║     ██║   ██║██████╔╝██║   ██║███████╗     ║"
echo "║  ██║     ██║     ██║   ██║██╔══██╗██║   ██║╚════██║     ║"
echo "║  ╚██████╗███████╗╚██████╔╝██████╔╝╚██████╔╝███████║     ║"
echo "║   ╚═════╝╚══════╝ ╚═════╝ ╚═════╝  ╚═════╝ ╚══════╝     ║"
echo "║                                                           ║"
echo "║        Facility Management System Setup v1.24.32         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo "🔍 Checking system prerequisites..."

# Function to check if a command exists
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2 is installed ($(command -v $1))"
        return 0
    else
        echo -e "${RED}✗${NC} $2 is not installed"
        return 1
    fi
}

# Check required tools
MISSING_DEPS=0

check_command node "Node.js" || {
    MISSING_DEPS=1
    echo -e "${YELLOW}  → Install from: https://nodejs.org/ (v18+ required)${NC}"
}

check_command npm "npm" || {
    MISSING_DEPS=1
    echo -e "${YELLOW}  → Comes with Node.js installation${NC}"
}

check_command git "Git" || {
    MISSING_DEPS=1
    echo -e "${YELLOW}  → Install from: https://git-scm.com/${NC}"
}

# Check optional but recommended tools
echo ""
echo "📦 Checking optional tools..."

check_command psql "PostgreSQL" || {
    echo -e "${YELLOW}  → Recommended for database access: https://www.postgresql.org/${NC}"
}

check_command redis-cli "Redis" || {
    echo -e "${YELLOW}  → Recommended for caching: https://redis.io/${NC}"
}

check_command code "VS Code" || {
    echo -e "${YELLOW}  → Recommended IDE: https://code.visualstudio.com/${NC}"
}

# Exit if missing required dependencies
if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo -e "${RED}❌ Please install missing required dependencies and run this script again.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ required. Current: $(node -v)${NC}"
    exit 1
fi

echo ""
echo "✅ All required dependencies are installed!"
echo ""
echo "📁 Setting up project structure..."

# Get the project root directory (two levels up from scripts/utilities)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
cd "$PROJECT_ROOT"

# Create necessary directories if they don't exist
mkdir -p data/logs data/backups data/temp
mkdir -p docs/audits docs/plans

echo ""
echo "🔧 Setting up backend..."
cd "$PROJECT_ROOT/ClubOSV1-backend"

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env from .env.example"
        echo -e "${YELLOW}  → Please edit ClubOSV1-backend/.env with your API keys${NC}"
    else
        echo -e "${RED}⚠${NC} No .env.example found. Please create .env manually"
    fi
else
    echo -e "${GREEN}✓${NC} .env already exists"
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Check if we can connect to database
if [ ! -z "$DATABASE_URL" ]; then
    echo "🗄️  Checking database connection..."
    npx tsx -e "require('./src/utils/database').db.authenticate().then(() => console.log('✅ Database connected')).catch(e => console.log('❌ Database connection failed:', e.message))" 2>/dev/null || true
fi

echo ""
echo "🎨 Setting up frontend..."
cd "$PROJECT_ROOT/ClubOSV1-frontend"

# Check if .env.local exists, if not copy from example
if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo -e "${GREEN}✓${NC} Created .env.local from .env.example"
        echo -e "${YELLOW}  → Please edit ClubOSV1-frontend/.env.local if needed${NC}"
    else
        echo -e "${RED}⚠${NC} No .env.example found. Please create .env.local manually"
    fi
else
    echo -e "${GREEN}✓${NC} .env.local already exists"
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "🔍 Checking TypeScript compilation..."
cd "$PROJECT_ROOT/ClubOSV1-backend"
echo -n "Backend: "
npx tsc --noEmit 2>/dev/null && echo -e "${GREEN}✓ No TypeScript errors${NC}" || echo -e "${YELLOW}⚠ Some TypeScript errors (run 'npx tsc --noEmit' for details)${NC}"

cd "$PROJECT_ROOT/ClubOSV1-frontend"
echo -n "Frontend: "
npx tsc --noEmit 2>/dev/null && echo -e "${GREEN}✓ No TypeScript errors${NC}" || echo -e "${YELLOW}⚠ Some TypeScript errors (run 'npx tsc --noEmit' for details)${NC}"

# Return to project root
cd "$PROJECT_ROOT"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Configure environment variables:"
echo "   - Edit ${BLUE}ClubOSV1-backend/.env${NC}"
echo "   - Edit ${BLUE}ClubOSV1-frontend/.env.local${NC}"
echo ""
echo "2. Run database migrations (if PostgreSQL is configured):"
echo "   ${BLUE}cd ClubOSV1-backend && npm run db:migrate${NC}"
echo ""
echo "3. Start the development servers:"
echo ""
echo "   Terminal 1 - Backend (Port 3000):"
echo "   ${BLUE}cd ClubOSV1-backend && npm run dev${NC}"
echo ""
echo "   Terminal 2 - Frontend (Port 3001):"
echo "   ${BLUE}cd ClubOSV1-frontend && npm run dev${NC}"
echo ""
echo "4. Open the application:"
echo "   ${BLUE}http://localhost:3001${NC}"
echo ""
echo "📚 Documentation:"
echo "   - README.md         : Quick start guide"
echo "   - ARCHITECTURE.md   : System overview"
echo "   - CONTRIBUTING.md   : Development standards"
echo "   - CLAUDE.md        : AI assistant context"
echo ""
echo "💡 Tips:"
echo "   - Use 'npx tsc --noEmit' to check TypeScript errors"
echo "   - Test on mobile viewport (375px width minimum)"
echo "   - All commits auto-deploy to production"
echo "   - Join the Slack for team communication"
echo ""
echo "🚀 Happy coding! Remember: this is production - test thoroughly!"
