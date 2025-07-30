#!/bin/bash

# Generate new secure secrets for ClubOS (only the ones actually used)

echo "🔐 Generating New Secure Secrets for ClubOS"
echo "=========================================="
echo ""
echo "These are the ACTUAL secrets used in your ClubOS backend:"
echo ""

echo "# ===== REQUIRED SECRETS ====="
echo "# Copy these to your Railway environment variables"
echo ""

echo "# JWT signing secret (for authentication tokens)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo ""

echo "# Session encryption secret"
echo "SESSION_SECRET=$(openssl rand -base64 32)"
echo ""

echo "# ===== OPTIONAL SECRETS (if using Slack) ====="
echo ""
echo "# Slack webhook verification (get from Slack app settings)"
echo "SLACK_SIGNING_SECRET=your-slack-signing-secret-from-slack-app"
echo ""

echo "# ===== WHAT TO DO NEXT ====="
echo "1. Copy the JWT_SECRET and SESSION_SECRET values above"
echo "2. Go to Railway dashboard > Your Project > Variables"
echo "3. Update these two variables:"
echo "   - JWT_SECRET"
echo "   - SESSION_SECRET"
echo "4. Your app will automatically redeploy"
echo ""
echo "⚠️  IMPORTANT: The old tokens will stop working immediately!"
echo "   Users may need to log in again."
