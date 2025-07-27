# ClubOSV1 Directory Structure

```
CLUBOSV1/
├── ClubOSV1-backend/     # Express/TypeScript API server
├── ClubOSV1-frontend/    # Next.js/TypeScript UI
├── ClubOS Agents/        # LLM agent configurations
├── scripts/              # Utility scripts
├── docs/                 # All documentation
│   ├── setup/
│   ├── deployment/
│   └── development/
├── archive/              # Old/completed files
├── .env.production.example
├── CHANGELOG.md         # Version history
├── README.md            # Main documentation
└── deploy-facility.sh   # Production deployment
```

## Quick Commands

```bash
# Backend
cd ClubOSV1-backend && npm run dev

# Frontend  
cd ClubOSV1-frontend && npm run dev

# Deploy to production
./deploy-facility.sh

# Generate deployment package
./generate-deployment-package.sh
```

## Latest Version: 1.6.1 (2025-07-27)
- PostgreSQL integration complete
- Multi-agent LLM routing active
- Deployed on Railway + Vercel
