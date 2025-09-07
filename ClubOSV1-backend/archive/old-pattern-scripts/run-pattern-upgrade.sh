#!/bin/bash

# Script to run the GPT-4 pattern upgrade on Railway
# This connects to the Railway production database

echo "================================================"
echo "V3-PLS Pattern Upgrade Script"
echo "================================================"
echo ""
echo "This script will upgrade 158 existing patterns using GPT-4"
echo "to add templates, variables, and intelligent matching."
echo ""
echo "Requirements:"
echo "1. OPENAI_API_KEY must be set in environment"
echo "2. DATABASE_URL must point to Railway production database"
echo ""
echo "Options:"
echo "1. Run locally with Railway database connection"
echo "2. Run directly on Railway via dashboard"
echo ""

# Check if we have the required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY is not set!"
    echo ""
    echo "To run locally, set your OpenAI API key:"
    echo "export OPENAI_API_KEY='your-key-here'"
    echo ""
    echo "Or run this script on Railway where it's already configured."
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set!"
    echo ""
    echo "To connect to Railway database, set:"
    echo "export DATABASE_URL='postgresql://...'"
    echo ""
    echo "You can find this in Railway dashboard → Backend → Variables"
    exit 1
fi

echo "✅ Environment variables configured"
echo ""
echo "Starting pattern upgrade..."
echo ""

# Run the upgrade script
cd "$(dirname "$0")/.."
npx tsx scripts/upgrade-patterns-gpt4.ts

echo ""
echo "================================================"
echo "Upgrade complete! Check the logs above for results."
echo "================================================"