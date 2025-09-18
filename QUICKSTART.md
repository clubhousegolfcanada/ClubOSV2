# ClubOS Quick Start Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git

## Initial Setup

### 1. Clone Repository
```bash
git clone [repository-url]
cd CLUBOSV1
```

### 2. Install Dependencies
```bash
# Backend
cd ClubOSV1-backend
npm install

# Frontend
cd ../ClubOSV1-frontend
npm install
```

### 3. Configure Environment

See [ENVIRONMENT.md](./ENVIRONMENT.md) for complete variable documentation.

#### Backend (.env)
```bash
cd ClubOSV1-backend
cp .env.example .env
# Edit .env with your values
```

#### Frontend (.env.local)
```bash
cd ClubOSV1-frontend
cp .env.example .env.local
# Edit .env.local with your values
```

### 4. Generate Required Keys
```bash
cd ClubOSV1-backend

# Generate VAPID keys for push notifications
node scripts/generate-vapid-keys.js

# Generate encryption key
openssl rand -base64 32

# Generate JWT secret
openssl rand -base64 64
```

### 5. Setup Database
```bash
cd ClubOSV1-backend

# Run migrations
npm run db:migrate

# Create admin user
npm run create:admin
```

## Local Development

### Start Services
```bash
# Terminal 1 - Backend
cd ClubOSV1-backend
npm run dev

# Terminal 2 - Frontend
cd ClubOSV1-frontend
npm run dev
```

### Access Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Production Deployment

### Automatic Deployment
```bash
git add -A
git commit -m "feat/fix: description"
git push origin main
```

This triggers automatic deployment:
- Frontend → Vercel (1-2 min)
- Backend → Railway (2-3 min)

### Manual Database Migrations
```bash
# Production migration
railway run npm run db:migrate
```

## Common Commands

### Backend
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run db:migrate       # Run migrations
npm run db:status        # Check migration status
npm run test             # Run tests
npm run create:admin     # Create admin user
```

### Frontend
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production build
npm test                 # Run tests
```

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL in .env
- Check PostgreSQL is running
- Ensure database exists

### Authentication Issues
- Clear browser cookies
- Verify JWT_SECRET is set
- Check user exists in database

### Build Failures
- Clear node_modules and reinstall
- Check Node version (18+ required)
- Verify all environment variables

### Production Issues
- Check Railway logs: `railway logs`
- Verify Vercel deployment status
- Monitor Sentry for errors

## Need Help?

- Documentation: [README.md](./README.md)
- Environment Setup: [ENVIRONMENT.md](./ENVIRONMENT.md)
- Architecture: [/docs/architecture/](./docs/architecture/)
- Report Issues: [GitHub Issues](https://github.com/anthropics/claude-code/issues)