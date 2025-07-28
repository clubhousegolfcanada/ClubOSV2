#!/bin/bash
# Generate ClubOS V1 deployment package for external facilities

echo "📦 Generating ClubOS V1 Deployment Package..."

# Create package directory
PACKAGE_DIR="clubos-v1-deployment-package"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"/{docs,scripts,config,templates}

# Copy essential documentation
cp CLUBOS_EXTERNAL_DEPLOYMENT_PACKAGE.md "$PACKAGE_DIR/docs/DEPLOYMENT_GUIDE.md"
cp TECHNICAL_AUDIT_REPORT.md "$PACKAGE_DIR/docs/TECHNICAL_AUDIT.md"
cp README.md "$PACKAGE_DIR/docs/README.md"
cp SETUP_GUIDE.md "$PACKAGE_DIR/docs/SETUP_GUIDE.md"
cp DEPLOYMENT.md "$PACKAGE_DIR/docs/DEPLOYMENT.md"
cp TESTING_GUIDE.md "$PACKAGE_DIR/docs/TESTING_GUIDE.md"

# Copy deployment script
cp deploy-facility.sh "$PACKAGE_DIR/scripts/"
chmod +x "$PACKAGE_DIR/scripts/deploy-facility.sh"

# Create environment templates
cat > "$PACKAGE_DIR/config/.env.backend.template" << 'EOF'
# ClubOS Backend Configuration Template
# Copy to .env and fill in your values

# Database (Railway provides this)
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production

# Authentication (Generate secure secrets)
JWT_SECRET=GENERATE_32_CHARACTER_SECRET_HERE
SESSION_SECRET=GENERATE_STRONG_SESSION_SECRET_HERE

# Server
PORT=3001
FRONTEND_URL=https://YOUR_FACILITY.vercel.app

# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_CHANNEL=#clubos-requests
SLACK_SIGNING_SECRET=YOUR_SLACK_SIGNING_SECRET

# OpenAI Configuration
OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4-turbo-preview

# GPT Assistant IDs (Pre-configured)
BOOKING_ACCESS_GPT_ID=asst_YeWa98dP4Dv0eXwyjMsCHeE7
EMERGENCY_GPT_ID=asst_YOUR_EMERGENCY_ASSISTANT_ID
TECH_SUPPORT_GPT_ID=asst_YOUR_TECH_SUPPORT_ASSISTANT_ID
BRAND_MARKETING_GPT_ID=asst_YOUR_BRAND_ASSISTANT_ID
EOF

cat > "$PACKAGE_DIR/config/.env.frontend.template" << 'EOF'
# ClubOS Frontend Configuration Template
NEXT_PUBLIC_API_URL=https://YOUR_BACKEND.railway.app/api
EOF

# Create quick start script
cat > "$PACKAGE_DIR/scripts/quick-start.sh" << 'EOF'
#!/bin/bash
# ClubOS V1 Quick Start Script

echo "🚀 ClubOS V1 Quick Start"
echo "========================"

# Check prerequisites
echo "Checking prerequisites..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ git is required"; exit 1; }

echo "✅ Prerequisites satisfied"

# Guide through setup
echo ""
echo "📋 Setup Steps:"
echo "1. Create accounts:"
echo "   - Railway: https://railway.app"
echo "   - Vercel: https://vercel.com"
echo "   - OpenAI: https://platform.openai.com"
echo "   - Slack: https://slack.com"
echo ""
echo "2. Configure environment:"
echo "   - Copy config/.env.*.template files"
echo "   - Fill in your values"
echo ""
echo "3. Deploy:"
echo "   - Run: ./deploy-facility.sh YOUR_FACILITY_NAME"
echo ""
echo "Need help? Contact support@clubos.com"
EOF

chmod +x "$PACKAGE_DIR/scripts/quick-start.sh"

# Create pricing sheet
cat > "$PACKAGE_DIR/docs/PRICING_SHEET.md" << 'EOF'
# ClubOS V1 Pricing Sheet

## Monthly Subscription: $2,000

### Included Services
- ✅ Complete ClubOS platform access
- ✅ Up to 10,000 AI-powered requests/month
- ✅ All infrastructure and hosting
- ✅ Business hours technical support
- ✅ Regular feature updates
- ✅ Daily automated backups
- ✅ 99.9% uptime SLA

### Optional Add-Ons
- **Additional AI Requests**: $0.10 per request over 10k
- **Priority 24/7 Support**: +$500/month
- **Custom Training Session**: $500 per 2-hour session
- **Knowledge Base Import**: $1,000 one-time
- **Custom Branding**: $500 one-time

### Implementation Costs
- **Standard Setup**: Included
- **Data Migration**: Quote based on volume
- **Custom Integrations**: Starting at $2,500

### Contract Terms
- Month-to-month billing
- No setup fees
- 30-day cancellation notice
- Annual discount: 10% (pay $21,600/year)

### ROI Calculator
**Monthly Savings**:
- Staff time (20 hrs @ $20/hr): $1,600
- Increased efficiency: $500
- Reduced no-shows: $300
- **Total Value**: $2,400/month
- **Net ROI**: $400/month (20%)

Contact: sales@clubos.com | 1-800-CLUBOS1
EOF

# Create sample contract
cat > "$PACKAGE_DIR/templates/SERVICE_AGREEMENT_TEMPLATE.md" << 'EOF'
# ClubOS Service Agreement Template

**This Service Agreement** ("Agreement") is entered into on [DATE] between ClubOS, Inc. ("Provider") and [FACILITY NAME] ("Client").

## 1. Services
Provider agrees to provide:
- ClubOS V1 golf simulator management platform
- Technical support during business hours
- Regular software updates and maintenance
- Data backup and recovery services

## 2. Fees
- Monthly subscription: $2,000
- Payment terms: Monthly in advance
- Late payment: 1.5% monthly interest

## 3. Term
- Initial term: Month-to-month
- Automatic renewal unless cancelled
- 30-day written notice required for cancellation

## 4. Service Level Agreement
- 99.9% uptime guarantee
- 4-hour response time for critical issues
- Daily automated backups
- Data retention: 30 days

## 5. Data & Privacy
- Client owns all data
- Provider ensures data security
- Compliance with privacy regulations
- Data export available upon request

## 6. Limitation of Liability
Provider's liability limited to monthly subscription fee.

## 7. Confidentiality
Both parties agree to maintain confidentiality.

**Client**: _______________________  
**Date**: _______________________

**Provider**: _______________________  
**Date**: _______________________
EOF

# Create implementation timeline
cat > "$PACKAGE_DIR/docs/IMPLEMENTATION_TIMELINE.md" << 'EOF'
# ClubOS Implementation Timeline

## Week 1: Foundation (Days 1-7)
### Monday-Tuesday
- ✓ Kick-off call with stakeholders
- ✓ Facility assessment and requirements
- ✓ Account creation (Railway, Vercel, etc.)

### Wednesday-Thursday
- ✓ Infrastructure provisioning
- ✓ Database setup
- ✓ Initial deployment

### Friday
- ✓ Slack integration setup
- ✓ OpenAI configuration
- ✓ Week 1 review call

## Week 2: Configuration (Days 8-14)
### Monday-Tuesday
- ✓ AI assistant configuration
- ✓ Knowledge base import
- ✓ Brand customization

### Wednesday-Thursday
- ✓ User account creation
- ✓ Role assignments
- ✓ Permission testing

### Friday
- ✓ Staff training session #1
- ✓ Documentation handoff
- ✓ Week 2 review

## Week 3: Testing (Days 15-21)
### Monday-Tuesday
- ✓ End-to-end testing
- ✓ Emergency procedures test
- ✓ Load testing

### Wednesday-Thursday
- ✓ Staff training session #2
- ✓ Kiosk setup and testing
- ✓ Integration verification

### Friday
- ✓ Parallel run begins
- ✓ Performance monitoring
- ✓ Feedback collection

## Week 4: Go-Live (Days 22-28)
### Monday
- ✓ Final system check
- ✓ Go/No-go decision
- ✓ Production cutover

### Tuesday-Thursday
- ✓ Live monitoring
- ✓ Issue resolution
- ✓ Performance tuning

### Friday
- ✓ Week 1 metrics review
- ✓ Success celebration
- ✓ Ongoing support handoff

## Post-Launch Support
### Week 5-8
- Weekly check-in calls
- Performance optimization
- Feature requests collection
- Monthly report generation
EOF

# Create README for the package
cat > "$PACKAGE_DIR/README.md" << 'EOF'
# ClubOS V1 Deployment Package

Welcome to the ClubOS V1 deployment package for golf simulator facilities!

## 📁 Package Contents

### /docs
- `DEPLOYMENT_GUIDE.md` - Complete deployment guide
- `TECHNICAL_AUDIT.md` - Technical specifications
- `SETUP_GUIDE.md` - Detailed setup instructions
- `PRICING_SHEET.md` - Pricing and ROI information
- `IMPLEMENTATION_TIMELINE.md` - 4-week rollout plan

### /scripts
- `quick-start.sh` - Quick start script
- `deploy-facility.sh` - Automated deployment tool

### /config
- `.env.backend.template` - Backend configuration
- `.env.frontend.template` - Frontend configuration

### /templates
- `SERVICE_AGREEMENT_TEMPLATE.md` - Contract template

## 🚀 Getting Started

1. Run the quick start script:
   ```bash
   cd scripts
   ./quick-start.sh
   ```

2. Review the documentation in the `/docs` folder

3. Contact our implementation team:
   - Email: support@clubos.com
   - Phone: 1-800-CLUBOS1

## 💰 Pricing

- **Monthly Subscription**: $2,000
- **No Setup Fees**
- **Month-to-Month Contract**
- **10% Annual Discount Available**

## 📞 Support

- Business Hours: M-F 9AM-5PM EST
- Email: support@clubos.com
- Phone: 1-800-CLUBOS1
- Emergency: Available with priority support add-on

---

© 2024 ClubOS, Inc. All rights reserved.
EOF

# Create archive
echo "Creating deployment package archive..."
tar -czf "clubos-v1-deployment-package.tar.gz" "$PACKAGE_DIR"

echo "✅ Deployment package created successfully!"
echo "📦 Files created:"
echo "   - clubos-v1-deployment-package/ (directory)"
echo "   - clubos-v1-deployment-package.tar.gz (archive)"
echo ""
echo "📋 Next steps:"
echo "1. Send package to potential client"
echo "2. Schedule implementation call"
echo "3. Begin 4-week deployment process"
