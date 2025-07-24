#!/bin/bash

# Generate secure secrets for ClubOSV1

echo "🔐 Generating secure secrets for ClubOSV1..."

# Function to generate a secure random string
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -base64 32
    else
        # Fallback to /dev/urandom if openssl is not available
        head -c 32 /dev/urandom | base64
    fi
}

# Check if .env file exists
ENV_FILE="ClubOSV1-backend/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found"
    echo "Please run this script from the CLUBOSV1 root directory"
    exit 1
fi

# Generate new secrets
JWT_SECRET=$(generate_secret)
SESSION_SECRET=$(generate_secret)

# Create a backup of the current .env file
cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup created: $ENV_FILE.backup.*"

# Update the .env file with new secrets
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
    sed -i '' "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" "$ENV_FILE"
else
    # Linux
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SECRET/" "$ENV_FILE"
fi

echo "✅ Secrets updated successfully!"
echo ""
echo "New JWT_SECRET: $JWT_SECRET"
echo "New SESSION_SECRET: $SESSION_SECRET"
echo ""
echo "⚠️  Important: These secrets are now unique to your installation."
echo "Keep them secure and never commit them to version control!"
