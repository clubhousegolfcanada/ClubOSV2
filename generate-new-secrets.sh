#!/bin/bash

# Generate new secure secrets for ClubOS

echo "🔐 Generating New Secure Secrets for ClubOS"
echo "=========================================="

echo -e "\n🔑 New JWT_SECRET:"
echo "JWT_SECRET=$(openssl rand -base64 32)"

echo -e "\n🔑 New SESSION_SECRET:"
echo "SESSION_SECRET=$(openssl rand -base64 32)"

echo -e "\n🔑 New API_KEY:"
echo "API_KEY=$(openssl rand -hex 32)"

echo -e "\n📋 Instructions:"
echo "1. Copy these new secrets"
echo "2. Update them in Railway environment variables"
echo "3. Update your local .env files"
echo "4. NEVER commit these values to Git!"

echo -e "\n⚠️  Additional Security Steps:"
echo "- Enable 2FA on your GitHub account"
echo "- Use GitHub's secret scanning feature"
echo "- Consider using GitHub Secrets for CI/CD"
echo "- Use a password manager for storing secrets"
