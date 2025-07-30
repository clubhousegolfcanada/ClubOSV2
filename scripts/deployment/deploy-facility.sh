#!/bin/bash
# ClubOS V1 - Facility Deployment Script
# Usage: ./deploy-facility.sh <facility-name>

set -e

FACILITY_NAME=${1:-"demo-facility"}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 ClubOS V1 Facility Deployment Script"
echo "======================================"
echo "Facility: $FACILITY_NAME"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found. Please install npm"
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        echo "❌ git not found. Please install git"
        exit 1
    fi
    
    echo "✅ All prerequisites satisfied"
}

# Create deployment structure
create_deployment_structure() {
    echo ""
    echo "📁 Creating deployment structure..."
    
    DEPLOY_DIR="deployments/${FACILITY_NAME}_${TIMESTAMP}"
    mkdir -p "$DEPLOY_DIR"/{config,scripts,docs,backups}
    
    echo "✅ Created deployment directory: $DEPLOY_DIR"
}

# Generate facility configuration
generate_facility_config() {
    echo ""
    echo "⚙️ Generating facility configuration..."
    
    cat > "$DEPLOY_DIR/config/facility.json" << EOF
{
  "facility": {
    "name": "$FACILITY_NAME",
    "deployment_date": "$TIMESTAMP",
    "configuration": {
      "kiosk_mode": true,
      "smart_assist_default": true,
      "slack_notifications": true,
      "emergency_escalation": true
    },
    "branding": {
      "primary_color": "#1a73e8",
      "logo_url": "/logo.png",
      "facility_name_display": "$FACILITY_NAME Golf Simulator"
    },
    "contact": {
      "support_email": "support@${FACILITY_NAME}.com",
      "emergency_phone": "1-800-EMERGENCY",
      "technical_support": "tech@clubos.com"
    }
  }
}
EOF
    
    echo "✅ Generated facility configuration"
}

# Generate environment templates
generate_env_templates() {
    echo ""
    echo "🔐 Generating environment templates..."
    
    # Backend .env template
    cat > "$DEPLOY_DIR/config/.env.backend.template" << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production

# Authentication
JWT_SECRET=GENERATE_32_CHARACTER_SECRET_HERE
SESSION_SECRET=GENERATE_STRONG_SESSION_SECRET_HERE

# Server Configuration
PORT=3001
FRONTEND_URL=https://FACILITY_NAME.vercel.app

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#clubos-requests
SLACK_SIGNING_SECRET=YOUR_SLACK_SIGNING_SECRET

# Facilities Notifications (Optional)
FACILITIES_SLACK_CHANNEL=#facilities
FACILITIES_SLACK_USER=U00000000

# OpenAI Configuration
OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4-turbo-preview

# GPT Assistant IDs (Pre-configured)
BOOKING_ACCESS_GPT_ID=asst_YeWa98dP4Dv0eXwyjMsCHeE7
EMERGENCY_GPT_ID=asst_YOUR_EMERGENCY_ASSISTANT_ID
TECH_SUPPORT_GPT_ID=asst_YOUR_TECH_SUPPORT_ASSISTANT_ID
BRAND_MARKETING_GPT_ID=asst_YOUR_BRAND_ASSISTANT_ID
EOF

    # Frontend .env template
    cat > "$DEPLOY_DIR/config/.env.frontend.template" << 'EOF'
NEXT_PUBLIC_API_URL=https://YOUR_BACKEND_URL.railway.app/api
EOF
    
    echo "✅ Generated environment templates"
}

# Generate deployment scripts
generate_deployment_scripts() {
    echo ""
    echo "📝 Generating deployment scripts..."
    
    # Railway deployment script
    cat > "$DEPLOY_DIR/scripts/deploy-railway.sh" << 'EOF'
#!/bin/bash
# Deploy ClubOS Backend to Railway

echo "🚂 Deploying to Railway..."

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login and deploy
railway login
railway init
railway up

echo "✅ Railway deployment complete"
echo "📋 Next steps:"
echo "1. Add PostgreSQL database in Railway dashboard"
echo "2. Configure environment variables"
echo "3. Note the deployment URL"
EOF

    # Vercel deployment script
    cat > "$DEPLOY_DIR/scripts/deploy-vercel.sh" << 'EOF'
#!/bin/bash
# Deploy ClubOS Frontend to Vercel

echo "▲ Deploying to Vercel..."

# Check Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Deploy
cd ClubOSV1-frontend
vercel --prod

echo "✅ Vercel deployment complete"
EOF

    # Database initialization script
    cat > "$DEPLOY_DIR/scripts/init-database.sh" << 'EOF'
#!/bin/bash
# Initialize ClubOS Database

echo "🗄️ Initializing database..."

cd ClubOSV1-backend

# Run migrations
npm run migrate

# Create admin user
npm run create:admin

echo "✅ Database initialized"
EOF

    chmod +x "$DEPLOY_DIR/scripts/"*.sh
    echo "✅ Generated deployment scripts"
}

# Generate documentation
generate_documentation() {
    echo ""
    echo "📚 Generating documentation..."
    
    # Quick start guide
    cat > "$DEPLOY_DIR/docs/QUICK_START.md" << EOF
# ClubOS Quick Start Guide - $FACILITY_NAME

## 1. Environment Setup
1. Copy .env templates from config/ directory
2. Fill in all required values
3. Generate secure secrets using: openssl rand -base64 32

## 2. Deploy Backend (Railway)
\`\`\`bash
cd scripts
./deploy-railway.sh
\`\`\`

## 3. Deploy Frontend (Vercel)
\`\`\`bash
cd scripts
./deploy-vercel.sh
\`\`\`

## 4. Initialize Database
\`\`\`bash
cd scripts
./init-database.sh
\`\`\`

## 5. Test Deployment
- Backend health: https://your-backend.railway.app/health
- Frontend: https://your-frontend.vercel.app
- Login with admin credentials created in step 4

## Support
Contact: support@clubos.com
EOF

    # Troubleshooting guide
    cat > "$DEPLOY_DIR/docs/TROUBLESHOOTING.md" << 'EOF'
# ClubOS Troubleshooting Guide

## Common Issues

### Cannot Connect to Database
- Verify DATABASE_URL in Railway environment
- Check PostgreSQL addon is provisioned
- Ensure connection string format is correct

### OpenAI API Errors
- Check API key validity
- Verify billing is active
- Check rate limits haven't been exceeded

### Slack Messages Not Sending
- Verify webhook URL is active
- Check channel permissions
- Test webhook with curl command

### Authentication Failed
- Clear browser cache and cookies
- Verify JWT_SECRET matches between deployments
- Check token expiration settings

## Debug Commands

```bash
# Check backend logs
railway logs

# Test database connection
node -e "const pg = require('pg'); /* test code */"

# Test Slack webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  YOUR_WEBHOOK_URL
```
EOF

    echo "✅ Generated documentation"
}

# Generate facility knowledge base
generate_knowledge_base() {
    echo ""
    echo "🧠 Generating knowledge base template..."
    
    mkdir -p "$DEPLOY_DIR/knowledge-base"
    
    cat > "$DEPLOY_DIR/knowledge-base/facility-info.json" << EOF
{
  "facility_name": "$FACILITY_NAME Golf Simulator",
  "hours": {
    "monday": "6:00 AM - 11:00 PM",
    "tuesday": "6:00 AM - 11:00 PM",
    "wednesday": "6:00 AM - 11:00 PM",
    "thursday": "6:00 AM - 11:00 PM",
    "friday": "6:00 AM - 12:00 AM",
    "saturday": "7:00 AM - 12:00 AM",
    "sunday": "7:00 AM - 10:00 PM"
  },
  "pricing": {
    "hourly": "$50",
    "membership_monthly": "$200",
    "membership_annual": "$2000"
  },
  "amenities": [
    "6 TrackMan simulator bays",
    "Full bar and restaurant",
    "Private event space",
    "Golf instruction available"
  ],
  "policies": {
    "cancellation": "24 hour notice required",
    "group_size": "Maximum 6 people per bay",
    "age_restriction": "21+ after 8 PM"
  }
}
EOF

    echo "✅ Generated knowledge base template"
}

# Create implementation checklist
create_implementation_checklist() {
    echo ""
    echo "📋 Creating implementation checklist..."
    
    cat > "$DEPLOY_DIR/IMPLEMENTATION_CHECKLIST.md" << EOF
# ClubOS Implementation Checklist - $FACILITY_NAME

## Week 1: Infrastructure Setup
- [ ] Create Railway account
- [ ] Create Vercel account  
- [ ] Set up Slack workspace
- [ ] Obtain OpenAI API key
- [ ] Configure domain names

## Week 2: Deployment
- [ ] Deploy backend to Railway
- [ ] Add PostgreSQL database
- [ ] Deploy frontend to Vercel
- [ ] Configure environment variables
- [ ] Initialize database

## Week 3: Configuration
- [ ] Create staff user accounts
- [ ] Configure AI assistants
- [ ] Import facility knowledge base
- [ ] Set up Slack channels
- [ ] Test all integrations

## Week 4: Training & Go-Live
- [ ] Train administrators (2 hours)
- [ ] Train operators (1 hour)
- [ ] Train support staff (30 min)
- [ ] Set up kiosk hardware
- [ ] Parallel run (3 days)
- [ ] Full cutover
- [ ] Monitor performance

## Post-Launch (Week 5)
- [ ] Collect user feedback
- [ ] Fine-tune AI responses
- [ ] Optimize routing rules
- [ ] Generate first month report

## Sign-offs
- [ ] Technical deployment complete - Date: _______
- [ ] Staff training complete - Date: _______
- [ ] Go-live approved - Date: _______
- [ ] Customer acceptance - Date: _______
EOF

    echo "✅ Created implementation checklist"
}

# Create monitoring dashboard
create_monitoring_setup() {
    echo ""
    echo "📊 Creating monitoring setup..."
    
    cat > "$DEPLOY_DIR/scripts/setup-monitoring.sh" << 'EOF'
#!/bin/bash
# Setup monitoring for ClubOS

echo "📊 Setting up monitoring..."

# Create monitoring queries
cat > monitor-queries.sql << SQL
-- Daily request volume
SELECT DATE(created_at) as date, 
       COUNT(*) as requests,
       AVG(confidence_score) as avg_confidence
FROM customer_interactions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Route distribution
SELECT route_selected,
       COUNT(*) as count,
       AVG(response_time_ms) as avg_response_time
FROM customer_interactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY route_selected;

-- Feedback summary
SELECT is_useful,
       COUNT(*) as count
FROM feedback
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY is_useful;

-- Active tickets
SELECT status,
       priority,
       COUNT(*) as count
FROM tickets
WHERE status != 'closed'
GROUP BY status, priority
ORDER BY priority DESC;
SQL

echo "✅ Monitoring queries created"
EOF

    chmod +x "$DEPLOY_DIR/scripts/setup-monitoring.sh"
    echo "✅ Created monitoring setup"
}

# Generate cost breakdown
generate_cost_breakdown() {
    echo ""
    echo "💰 Generating cost breakdown..."
    
    cat > "$DEPLOY_DIR/docs/COST_BREAKDOWN.md" << 'EOF'
# ClubOS Cost Breakdown

## Monthly Costs

### Infrastructure
- Railway (Backend + PostgreSQL): ~$20/month
- Vercel (Frontend): Free tier (or ~$20/month Pro)
- Domain names: ~$2/month

### API Services  
- OpenAI GPT-4: ~$50-200/month (based on usage)
  - Estimated 10,000 requests @ $0.01-0.02 per request
- Slack: Free tier sufficient

### Total Infrastructure Cost: ~$100-250/month

## Revenue Model

### Subscription: $2,000/month includes:
- All infrastructure costs
- Up to 10,000 AI requests
- Technical support
- Regular updates
- Daily backups

### Profit Margin: ~$1,750-1,900/month (87-95%)

## Additional Revenue Opportunities
- Custom training: $500/session
- Extra AI requests: $0.10/request over 10k
- Priority support: $500/month
- Custom integrations: Quote basis

## ROI for Facility
- Staff time saved: ~$1,600/month
- Increased efficiency: ~$500/month
- Reduced no-shows: ~$300/month
- **Total value: ~$2,400/month**
- **Net benefit: $400/month**
EOF

    echo "✅ Generated cost breakdown"
}

# Create backup script
create_backup_script() {
    echo ""
    echo "💾 Creating backup script..."
    
    cat > "$DEPLOY_DIR/scripts/backup-facility.sh" << 'EOF'
#!/bin/bash
# Backup ClubOS facility data

BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "💾 Starting ClubOS backup..."

# Backup database
echo "Backing up database..."
pg_dump $DATABASE_URL > "$BACKUP_DIR/database.sql"

# Backup configuration
echo "Backing up configuration..."
cp -r config "$BACKUP_DIR/"

# Backup logs
echo "Backing up logs..."
cp -r ClubOSV1-backend/logs "$BACKUP_DIR/"

# Create archive
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "✅ Backup complete: $BACKUP_DIR.tar.gz"
EOF

    chmod +x "$DEPLOY_DIR/scripts/backup-facility.sh"
    echo "✅ Created backup script"
}

# Generate final summary
generate_summary() {
    echo ""
    echo "📄 Generating deployment summary..."
    
    cat > "$DEPLOY_DIR/DEPLOYMENT_SUMMARY.md" << EOF
# ClubOS Deployment Summary - $FACILITY_NAME

Generated: $TIMESTAMP

## Package Contents

### /config
- facility.json - Facility-specific configuration
- .env.backend.template - Backend environment template
- .env.frontend.template - Frontend environment template

### /scripts  
- deploy-railway.sh - Backend deployment script
- deploy-vercel.sh - Frontend deployment script
- init-database.sh - Database initialization
- setup-monitoring.sh - Monitoring setup
- backup-facility.sh - Backup script

### /docs
- QUICK_START.md - Quick start guide
- TROUBLESHOOTING.md - Common issues and solutions
- COST_BREAKDOWN.md - Detailed cost analysis

### /knowledge-base
- facility-info.json - Facility information template

### Root Files
- IMPLEMENTATION_CHECKLIST.md - Week-by-week checklist
- DEPLOYMENT_SUMMARY.md - This file

## Next Steps

1. Review all configuration files
2. Set up hosting accounts (Railway, Vercel)
3. Configure environment variables
4. Follow QUICK_START.md guide
5. Complete IMPLEMENTATION_CHECKLIST.md

## Support

ClubOS Implementation Team
- Email: support@clubos.com
- Phone: 1-800-CLUBOS1
- Slack: #clubos-support

## Contract

Monthly subscription: $2,000
- Includes all infrastructure
- Up to 10,000 AI requests/month  
- Business hours support
- Regular updates

---
Deployment package generated successfully!
EOF

    echo "✅ Generated deployment summary"
}

# Main execution
main() {
    check_prerequisites
    create_deployment_structure
    generate_facility_config
    generate_env_templates
    generate_deployment_scripts
    generate_documentation
    generate_knowledge_base
    create_implementation_checklist
    create_monitoring_setup
    generate_cost_breakdown
    create_backup_script
    generate_summary
    
    echo ""
    echo "✅ Deployment package created successfully!"
    echo "📁 Location: $DEPLOY_DIR"
    echo ""
    echo "📋 Next steps:"
    echo "1. Review DEPLOYMENT_SUMMARY.md"
    echo "2. Customize configuration files"
    echo "3. Follow IMPLEMENTATION_CHECKLIST.md"
    echo ""
}

# Run main function
main
