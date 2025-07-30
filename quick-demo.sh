#!/bin/bash
# quick-demo.sh - Show your expert friend the evolution

echo "=== ClubOS Evolution Demo ==="
echo "From: Single index.html"
echo "To: Production AI-powered facility management"
echo ""

# Show structure
echo "📁 Architecture Overview:"
tree -L 2 -d ClubOSV1/ 2>/dev/null || {
    echo "ClubOSV1/"
    echo "├── ClubOSV1-backend/     # Express API (Railway)"
    echo "├── ClubOSV1-frontend/    # Next.js 14 (Vercel)"
    echo "├── scripts/              # Deployment automation"
    echo "└── docs/                 # System documentation"
}

echo ""
echo "🚀 Live Endpoints:"
echo "Frontend: https://clubos.vercel.app"
echo "Backend API: https://clubosv1-backend-production.up.railway.app"
echo ""

echo "🧠 AI Integration:"
echo "- GPT-4 request routing with confidence scoring"
echo "- 4 specialized assistant bots"
echo "- Automatic Slack fallback for complex queries"
echo ""

echo "📊 Database Schema:"
echo "- PostgreSQL on Railway"
echo "- 8 core tables (users, tickets, checklists, etc.)"
echo "- Automated migrations system"
echo ""

echo "🔒 Security:"
echo "- JWT authentication (24h tokens)"
echo "- Role-based access control"
echo "- Rate limiting (100 req/15min)"
echo "- Helmet.js + CORS protection"
echo ""

echo "📈 Current Stats:"
echo "- Version: 1.8.1"
echo "- Dependencies: 38 production, 25 dev"
echo "- API Routes: 14 main endpoints"
echo "- Test Coverage: ~40% (needs work)"
echo ""

echo "💡 Key Technical Decisions:"
echo "- TypeScript everywhere"
echo "- Monorepo structure"
echo "- Vercel + Railway deployment"
echo "- Zustand for state management"
echo "- Sentry for error tracking"
echo ""

echo "🔧 Run locally:"
echo "cd CLUBOSV1 && npm run dev"
echo ""

echo "📝 Full audit: cat CLUBOS_AUDIT.md"