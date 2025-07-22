#!/bin/bash

# ClubOSV1 Environment Setup Script

echo "🔧 ClubOSV1 Environment Configuration Setup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Backend directory
BACKEND_DIR="/Users/michaelbelairch1/Desktop/Clubhouse OS (Root)/CLUBOSV1/ClubOSV1-backend"
ENV_FILE="$BACKEND_DIR/.env"

echo -e "\n${YELLOW}This script will help you configure your environment variables.${NC}"
echo -e "${YELLOW}Current .env file location: $ENV_FILE${NC}\n"

# Function to generate random secret
generate_secret() {
    openssl rand -base64 32
}

# Check if .env exists
if [ -f "$ENV_FILE" ]; then
    echo -e "${BLUE}📄 .env file already exists.${NC}"
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Skipping environment configuration.${NC}"
        exit 0
    fi
fi

echo -e "\n${YELLOW}Let's configure your environment:${NC}\n"

# Generate secure secrets
echo -e "${GREEN}🔐 Generating secure secrets...${NC}"
JWT_SECRET=$(generate_secret)
SESSION_SECRET=$(generate_secret)
echo -e "${GREEN}✓ Secrets generated${NC}\n"

# Get OpenAI API Key
echo -e "${YELLOW}🤖 OpenAI Configuration${NC}"
echo "To use AI features, you need an OpenAI API key."
echo "Get one at: https://platform.openai.com/api-keys"
read -p "Enter your OpenAI API key (or press Enter to skip): " OPENAI_KEY

# Get Slack configuration
echo -e "\n${YELLOW}💬 Slack Configuration (Optional)${NC}"
echo "For Slack integration, you need a webhook URL and signing secret."
echo "Create a Slack app at: https://api.slack.com/apps"
read -p "Enter your Slack Webhook URL (or press Enter to skip): " SLACK_WEBHOOK
read -p "Enter your Slack Signing Secret (or press Enter to skip): " SLACK_SECRET

# Create the .env file
cat > "$ENV_FILE" << EOL
# ClubOSV1 Backend Environment Configuration
# Generated on $(date)

# Server Configuration
PORT=3001
NODE_ENV=development

# Security Keys (Auto-generated - Keep these secret!)
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# OpenAI Configuration
OPENAI_API_KEY=${OPENAI_KEY:-sk-your-openai-api-key-here}
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.3

# Slack Configuration
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK:-}
SLACK_SIGNING_SECRET=${SLACK_SECRET:-your-slack-signing-secret-here}
SLACK_CHANNEL=#clubos-requests
SLACK_USERNAME=ClubOSV1 Bot
SLACK_ICON_EMOJI=:golf:

# Logging Configuration
LOG_LEVEL=info
LOG_TO_FILE=true
LOG_MAX_FILES=5
LOG_MAX_SIZE=5242880

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# Feature Flags
ENABLE_DEMO_MODE=true
ENABLE_DEBUG_ENDPOINTS=false
ENABLE_SWAGGER_DOCS=true

# Performance
MAX_REQUEST_SIZE=10mb
REQUEST_TIMEOUT=30000
WORKER_THREADS=0

# Data Management
DATA_RETENTION_DAYS=90
BACKUP_RETENTION_DAYS=30
EOL

echo -e "\n${GREEN}✅ Environment configuration complete!${NC}"
echo -e "${BLUE}📄 Configuration saved to: $ENV_FILE${NC}\n"

# Validate the configuration
echo -e "${YELLOW}Validating configuration...${NC}"
cd "$BACKEND_DIR"

# Try to run the backend
echo -e "\n${YELLOW}Starting backend server...${NC}"
npm run dev
