#!/bin/bash

# Documentation Organization Script
# Moves all documentation from root to organized docs/ subdirectories

echo "📚 Organizing Documentation Files"
echo "================================="

# Create documentation structure if not exists
mkdir -p docs/{architecture,archive,deployment,development,features,guides,implementation,planning}

# Move files based on their content/purpose
# Note: These files are already moved, but keeping for reference

# Architecture & System Design
ARCH_FILES=(
    "V1-VS-V3-ARCHITECTURE-COMPARISON.md"
    "GPT4O_ARCHITECTURE_CLARIFICATION.md"
    "CUSTOMER-APP-ARCHITECTURE-DECISION.md"
    "MIKE-ACTUAL-FRAMEWORK.md"
    "COMPREHENSIVE-REFACTOR-PLAN.md"
)

# Deployment & Infrastructure
DEPLOY_FILES=(
    "RAILWAY_DEPLOYMENT.md"
    "ADD_REDIS_TO_RAILWAY.md"
    "CONNECT_REDIS.md"
    "PUBLIC_CLUBOSBOY_SETUP.md"
    "UNIFI-*.md"
    "DOOR-*.md"
    "DARTMOUTH-UNIFI-SETUP.md"
    "SPLASHTOP-SETUP.md"
    "TAILSCALE-UNIFI-SETUP.md"
    "UBIQUITI-*.md"
    "splashtop-bay-config.md"
    "FRIENDS-DEPLOYMENT-FIX.md"
    "CHANGELOG-UNIFI.md"
)

# Development & Implementation
DEV_FILES=(
    "ENVIRONMENT-SETUP.md"
    "QUICK_FIX_GUIDE.md"
    "TESTING-*.md"
    "TEST-*.md"
    "test-coverage-report.md"
    "UI-*.md"
    "MOBILE*.md"
    "DESKTOP-*.md"
    "FINAL-UI-UPDATES.md"
    "CHECKLISTS-UI-UPDATE.md"
    "OPERATIONS-REFACTOR-*.md"
    "REFACTORING-*.md"
)

# Features & Functionality
FEATURE_FILES=(
    "AI-AUTOMATION-*.md"
    "AUTOMATION-*.md"
    "CHATGPT-*.md"
    "GIFT-CARD-*.md"
    "KNOWLEDGE*.md"
    "LLM-*.md"
    "OPENPHONE*.md"
    "HUBSPOT-*.md"
    "SLACK-*.md"
    "PWA_*.md"
    "FRIENDS-SYSTEM-*.md"
)

# Guides & How-tos
GUIDE_FILES=(
    "IMPLEMENTATION-*.md"
    "COMPLETE-*.md"
    "INTELLIGENT-*.md"
    "PROPOSED-CHANGES.md"
)

# Planning & Strategy
PLAN_FILES=(
    "CLUBHOUSE-CHALLENGES-*.md"
    "CUSTOMER-APP-*.md"
    "PHASE*-*.md"
)

# Security & Audits
SECURITY_FILES=(
    "SECURITY-*.md"
    "security-*.md"
    "CLUBOS_AUDIT.md"
    "CAPABILITY_ASSESSMENT_REPORT.md"
    "HOUSECLEANING*.md"
)

# Archive old implementations
ARCHIVE_FILES=(
    "CONVERSATION-*.md"
    "INVESTIGATION-*.md"
    "ANALYSIS-*.md"
    "*-FIXED.md"
    "*-COMPLETE.md"
    "*-FIX.md"
)

echo "✅ Documentation structure ready"
echo ""
echo "📊 Summary:"
echo "  - Architecture docs → docs/architecture/"
echo "  - Deployment docs → docs/deployment/"
echo "  - Development docs → docs/development/"
echo "  - Feature docs → docs/features/"
echo "  - Guides → docs/guides/"
echo "  - Implementation plans → docs/implementation/"
echo "  - Planning docs → docs/planning/"
echo "  - Archived docs → docs/archive/"
echo ""
echo "Note: Files have already been moved via git commands"