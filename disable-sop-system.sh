#!/bin/bash

# Disable SOP System Script
# This script updates environment variables to disable the Intelligent SOP Module
# and switch back to using OpenAI Assistants directly

echo "🔧 Disabling Intelligent SOP Module..."

# Backend .env file
BACKEND_ENV="ClubOSV1-backend/.env"

# Update or add environment variables
if [ -f "$BACKEND_ENV" ]; then
    echo "📝 Updating backend environment variables..."
    
    # Function to update or add env variable
    update_env() {
        local key=$1
        local value=$2
        local file=$3
        
        if grep -q "^${key}=" "$file"; then
            # Update existing
            sed -i.bak "s/^${key}=.*/${key}=${value}/" "$file"
        else
            # Add new
            echo "${key}=${value}" >> "$file"
        fi
    }
    
    # Disable SOP system
    update_env "USE_INTELLIGENT_SOP" "false" "$BACKEND_ENV"
    update_env "SOP_SHADOW_MODE" "false" "$BACKEND_ENV"
    update_env "SOP_ENABLED" "false" "$BACKEND_ENV"
    update_env "SOP_CONFIDENCE_THRESHOLD" "0.0" "$BACKEND_ENV"
    update_env "SOP_ROLLOUT_PERCENTAGE" "0" "$BACKEND_ENV"
    
    echo "✅ Environment variables updated"
else
    echo "⚠️  Backend .env file not found at $BACKEND_ENV"
    echo "Creating example .env file..."
    
    cat > "$BACKEND_ENV.example" << EOF
# SOP System Configuration (DISABLED)
USE_INTELLIGENT_SOP=false
SOP_SHADOW_MODE=false
SOP_ENABLED=false
SOP_CONFIDENCE_THRESHOLD=0.0
SOP_ROLLOUT_PERCENTAGE=0

# Add your other environment variables here
# DATABASE_URL=
# OPENAI_API_KEY=
# JWT_SECRET=
# SLACK_WEBHOOK_URL=
EOF
    
    echo "📄 Created $BACKEND_ENV.example - please rename to .env and add your secrets"
fi

echo ""
echo "🎯 Next steps:"
echo "1. Restart the backend server to apply changes"
echo "2. The system will now use OpenAI Assistants directly"
echo "3. Knowledge updates go through the new GPT-4o router"
echo ""
echo "✅ SOP system disabled successfully!"