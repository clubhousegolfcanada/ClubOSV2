#!/bin/bash

# Deploy Semantic Search for Pattern Learning System
# This script runs the migration and generates embeddings

set -e

echo "🚀 Deploying Semantic Search for V3-PLS..."
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from ClubOSV1-backend directory${NC}"
    exit 1
fi

# Load environment variables
echo -e "${YELLOW}⚠️  Loading environment variables from .env...${NC}"
export $(cat .env | grep -v '^#' | xargs)

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL not set${NC}"
    exit 1
fi

# Check for OPENAI_API_KEY  
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ Error: OPENAI_API_KEY not set${NC}"
    echo "This is required to generate embeddings"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Step 1: Run the migration
echo "📦 Step 1: Running database migration..."
echo "----------------------------------------"
psql $DATABASE_URL < src/database/migrations/203_pattern_embeddings.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration completed successfully${NC}"
else
    echo -e "${RED}❌ Migration failed${NC}"
    exit 1
fi

echo ""

# Step 2: Generate embeddings
echo "🧮 Step 2: Generating embeddings for patterns..."
echo "------------------------------------------------"
npm run generate-embeddings

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Embeddings generated successfully${NC}"
else
    echo -e "${RED}❌ Embedding generation failed${NC}"
    exit 1
fi

echo ""

# Step 3: Verify deployment
echo "🔍 Step 3: Verifying deployment..."
echo "----------------------------------"

# Check how many patterns have embeddings
RESULT=$(psql $DATABASE_URL -t -c "
    SELECT 
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
        COUNT(*) as total
    FROM decision_patterns
    WHERE is_active = TRUE
")

echo "Pattern Statistics:"
echo "$RESULT"

# Check for high similarity patterns
echo ""
echo "Checking for duplicate patterns..."
DUPLICATES=$(psql $DATABASE_URL -t -c "
    SELECT COUNT(*) 
    FROM pattern_similarities 
    WHERE similarity_score > 0.95
")

echo "Found $DUPLICATES potential duplicate patterns"

echo ""
echo -e "${GREEN}🎉 Semantic Search Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Monitor pattern matching performance"
echo "2. Adjust similarity threshold if needed (currently 0.75)"
echo "3. Review and merge duplicate patterns"
echo "4. Enable confidence evolution if not already active"
echo ""
echo "To test semantic search:"
echo "  - Send a message through OpenPhone"
echo "  - Check pattern_execution_history for match_type = 'semantic'"
echo ""
echo "To view similar patterns:"
echo "  psql \$DATABASE_URL -c 'SELECT * FROM pattern_similarities ORDER BY similarity_score DESC LIMIT 10;'"
echo ""